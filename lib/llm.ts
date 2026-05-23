// LLM 통합 (숙명여대 API Gateway / Mindlogic factchat)
// - 게이트웨이는 OpenAI 호환 Chat Completions 형식을 제공한다.
//   문서: https://docs.mindlogic.ai/docs/sookmyung/gateway/getting-started/overview
// - 단일 키 (MINDLOGIC_API_KEY) 로 OpenAI / Claude / Gemini 등의 모델에 동일한 인터페이스로 접근한다.
// - 호출은 최소화: 사용자 리포트 1회, repo 분석 1회 (한 프롬프트로 N개 묶음).
// - JSON 응답이 깨지면 fallback 으로 UI가 항상 무엇이든 보여줄 수 있도록 한다.
// - 키가 없으면 provider = "none" 으로 두고 호출을 생략한다.
//
// === 재현성 (determinism) 설계 ===
// 같은 사용자에 대해 여러 번 호출해도 비슷한 결과가 나오도록 다음을 보장한다.
// 1) 샘플링 파라미터를 greedy 에 가깝게 둔다.
//    - temperature=0 (가장 중요), seed=<payload 해시>
//    - top_p / penalty 는 게이트웨이 뒷단 모델(특히 Claude) 이 거절하므로 보내지 않는다.
// 2) 입력 페이로드를 stable serialization 으로 직렬화 (객체 key 알파벳 순).
// 3) seed 는 (payload + 프롬프트 버전) 의 결정적 해시.
//    게이트웨이 뒤의 모델이 GPT 계열일 때 seed 가 그대로 반영되어 byte 단위에 가까운 재현이 가능.
//    Claude / Gemini 계열은 seed 를 무시할 수 있지만, 다른 장치 (temperature=0, 화이트리스트) 로 어휘/구조 변동을 최소화한다.
// 4) 프롬프트에 sentence template / 어휘 화이트리스트 / few-shot 예시를 넣어 자유도를 낮춘다.

import type {
  ActivityPattern,
  AnalyzedRepo,
  DomainScores,
  LLMRepoReport,
  LLMUserReport,
} from "./types";

export type LlmProvider = "gateway" | "none";

const DEFAULT_GATEWAY_BASE_URL = "https://factchat-cloud.mindlogic.ai/v1/gateway";
const DEFAULT_GATEWAY_MODEL = "claude-sonnet-4-6";

const GATEWAY_BASE_URL = (process.env.MINDLOGIC_BASE_URL ?? DEFAULT_GATEWAY_BASE_URL).replace(/\/+$/, "");
const GATEWAY_MODEL = process.env.MINDLOGIC_MODEL ?? DEFAULT_GATEWAY_MODEL;

// 환경 변수로 미세 조정 가능하지만, 기본값은 재현성 최우선으로 0 에 가깝게 둔다.
const LLM_TEMPERATURE = Number(process.env.LLM_TEMPERATURE ?? "0");

// 프롬프트 버전. 프롬프트 본문 또는 호출 파라미터 형태가 바뀌면 이 문자열을 올려
// seed 와 캐시(buildAnalyzeCacheKey 는 별도지만 분석 결과 자체 캐시) 가 자동으로 무효화되도록 한다.
const PROMPT_VERSION = "v5-scope-neutral-2026-05-23";

export function detectLlmProvider(): LlmProvider {
  if (process.env.MINDLOGIC_API_KEY) return "gateway";
  return "none";
}

// === 입력 페이로드 빌더 (LLM 토큰 절약을 위해 요약형 데이터만 전달) ===
export type UserReportInput = {
  username: string;
  scope: string; // "공개 저장소" / "본인 전체 저장소(private 포함)" 등 분석 범위 라벨
  repo_count: number;
  top_languages: string[];
  domain_scores: DomainScores;
  activity_pattern: Pick<ActivityPattern, "night_ratio" | "morning_ratio" | "weekend_ratio" | "consistency_score">;
  top_tags_candidates: string[];
  top_repos_summary: string[];
};

export type RepoReportInput = {
  repo_name: string;
  description: string | null;
  readme_reliability: string;
  languages: string[];
  tech_stack: string[];
  structure_summary: string[];
  recent_commits: string[];
  inference_notes: string[];
};

export function buildUserReportInput(opts: {
  username: string;
  scope: string;
  publicRepos: number;
  topLanguages: string[];
  domainScores: DomainScores;
  activity: ActivityPattern;
  topTags: string[];
  selectedRepos: AnalyzedRepo[];
}): UserReportInput {
  return {
    username: opts.username,
    scope: opts.scope,
    repo_count: opts.publicRepos,
    top_languages: opts.topLanguages.slice(0, 5),
    domain_scores: opts.domainScores,
    activity_pattern: {
      night_ratio: opts.activity.night_ratio,
      morning_ratio: opts.activity.morning_ratio,
      weekend_ratio: opts.activity.weekend_ratio,
      consistency_score: opts.activity.consistency_score,
    },
    top_tags_candidates: opts.topTags,
    top_repos_summary: opts.selectedRepos.map((r) =>
      [r.name, r.description].filter(Boolean).join(" - ") || r.name,
    ),
  };
}

export function buildRepoReportInputs(repos: AnalyzedRepo[]): RepoReportInput[] {
  return repos.map((repo) => ({
    repo_name: repo.name,
    description: repo.description,
    readme_reliability: repo.readmeReliability.level,
    languages: repo.language ? [repo.language] : [],
    tech_stack: repo.techStack,
    structure_summary: repo.structureSummary.slice(0, 8),
    recent_commits: repo.recentCommitMessages.slice(0, 6),
    inference_notes: repo.inferenceNotes,
  }));
}

// === stable serialization & seed ===
// 객체 key 순서, 배열 순서를 가능한 한 결정적으로 만들기 위해 직접 작성한 직렬화.
// 배열 순서가 의미를 가지는 경우(commit 순서 등)는 그대로 두고, key 순서만 알파벳 순으로 정렬한다.
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

// OpenAI seed 는 부호 있는 32-bit 정수 권장. 단순 djb2 변형으로 결정적 해시 생성.
function deterministicSeed(stableInput: string, salt: string): number {
  let hash = 5381;
  const combined = `${salt}|${stableInput}`;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) + hash + combined.charCodeAt(i)) | 0;
  }
  return hash;
}

// === 프롬프트 ===
// 자유도를 낮추기 위해 다음 장치를 사용한다.
// - 문장 템플릿 / 어휘 화이트리스트
// - 길이 상한 (글자 수 / 항목 수 고정)
// - few-shot 예시 1개 (톤/구조 고정)
// 프롬프트가 바뀌면 PROMPT_VERSION 도 함께 올려 seed 가 같이 바뀌도록 한다.

const USER_SYSTEM_PROMPT = `당신은 개발자의 GitHub 저장소 분석 결과를 정리해 한국어 리포트 헤드라인과 요약을 작성하는 분석가입니다.
입력으로 받은 통계와 태그 후보만 근거로 사용하고, 추측이나 과장은 금지합니다.
분석 대상이 공개 저장소만인지, 본인 전체 저장소(private 포함)인지는 입력의 scope 필드를 그대로 따르세요.

[출력 형식 절대 규칙]
- 응답 전체는 유효한 JSON 객체 하나여야 합니다.
- "{" 로 시작해 "}" 로 끝나야 합니다.
- JSON 앞이나 뒤에 인사말, 설명, 주석, 마크다운 코드 블록(\`\`\`json ... \`\`\`), 줄바꿈 외 어떤 텍스트도 출력 금지.
- 위반 시 응답이 자동으로 폐기됩니다.

JSON 스키마:
{
  "headline": string,
  "summary": string,
  "tags": [{ "name": string, "reason": string }],
  "warnings": string[]
}

[표현 원칙]
- 단정 표현 금지. "프론트엔드 개발자입니다", "야간형 개발자입니다" 같은 문장 사용 금지.
- 대신 "분석 대상 저장소 기준 ~ 비중이 높게 나타납니다", "~ 경향이 관찰됩니다" 같이 추정형으로 작성.
- 입력 데이터에 없는 사실(회사명, 학력, 경력 등)은 절대 추가 금지.
- 결과가 분석 대상 저장소 데이터(scope 값)에 한정된 추정임을 헤드라인/요약 어디선가 인지 가능하게 표현.

[필드별 고정 규칙]
- headline:
  - 정확히 1문장, 30~60자.
  - 반드시 아래 두 형식 중 하나로 끝낼 것.
    1) "...활동 경향을 보이는 개발자"
    2) "...이/가 두드러지는 GitHub 활동 프로필"
  - 입력의 domain_scores 중 가장 높은 두 도메인만 헤드라인에 반영.
- summary:
  - 정확히 3문장, 합쳐서 240자 이내.
  - 1문장: 가장 높은 도메인 점수와 두 번째 도메인 점수의 비중을 추정형으로 서술.
  - 2문장: top_languages 와 대표 repo summary 에서 관찰되는 기술 스택 경향.
  - 3문장: activity_pattern (야간/주말/일관성) 중 의미 있는 값 하나를 경향으로 서술.
- tags:
  - 입력의 top_tags_candidates 중에서만 골라 사용. 새로 만들지 말 것.
  - 최대 4개, 가장 점수가 높을 것 같은 순서.
  - 각 reason 은 정확히 1문장, 60자 이내, "~ 기준 ~ 비중이 높음" 같은 추정형.
- warnings:
  - 분석 대상이 무엇인지(scope 값) 추정 결과라는 점을 반드시 1줄 포함.
  - README/표본 부족 등 신뢰도가 낮은 신호가 있으면 1줄 추가.
  - 최대 3개.

[예시 응답]
입력 예: { "username": "sample", "scope": "공개 저장소", "domain_scores": { "frontend": 78, "backend": 64, "data_ml": 41, "mobile": 10, "devops": 23, "collaboration": 52 }, "top_languages": ["TypeScript","Python"], "activity_pattern": { "night_ratio": 0.61, "weekend_ratio": 0.35, "consistency_score": 0.72 }, "top_tags_candidates": ["프론트엔드 비중 높음","야간 활동 경향","꾸준한 커밋형"], "top_repos_summary": ["focusdash - productivity dashboard"] }
출력 예: {"headline":"프론트엔드 비중과 꾸준한 활동이 두드러지는 GitHub 활동 프로필","summary":"분석 대상 저장소 기준 프론트엔드 비중이 가장 높게 나타나며 백엔드 활동도 함께 관찰됩니다. TypeScript 와 Python 사용 빈도가 높고 대표 repo 에서도 웹 대시보드 경향이 보입니다. KST 환산 기준 야간 시간대 활동 비중이 높은 편입니다.","tags":[{"name":"프론트엔드 비중 높음","reason":"분석 대상 저장소 기준 프론트엔드 도메인 점수가 가장 높게 나타남"},{"name":"꾸준한 커밋형","reason":"commit 일관성 점수가 0.7 이상으로 관찰됨"}],"warnings":["본 결과는 공개 저장소 데이터를 기반으로 한 추정입니다."]}`;

const REPO_SYSTEM_PROMPT = `당신은 GitHub 저장소 분석 결과를 이력서/포트폴리오용 한국어 문장으로 정리하는 작가입니다.
입력 데이터만 근거로 사용하고 코드를 추측하지 마세요.

[출력 형식 절대 규칙]
- 응답 전체는 유효한 JSON 객체 하나여야 합니다.
- "{" 로 시작해 "}" 로 끝나야 합니다.
- JSON 앞이나 뒤에 인사말, 설명, 주석, 마크다운 코드 블록(\`\`\`json ... \`\`\`), 줄바꿈 외 어떤 텍스트도 출력 금지.
- 위반 시 응답이 자동으로 폐기됩니다.

입력은 { "repos": RepoInput[] } 형태입니다. 각 repo 에 대해 다음 JSON 스키마로 응답하세요.
{
  "reports": [
    {
      "repo_name": string,
      "project_summary": string,
      "core_features": string[],
      "portfolio_sentence": string,
      "resume_bullets": string[],
      "interview_questions": string[],
      "confidence": "high" | "medium" | "low" | "missing"
    }
  ]
}

[표현 원칙]
- 단정 금지. "Next.js 프로젝트입니다" → "구조와 설정 파일 기준 Next.js 기반으로 추정됩니다" 처럼 추정형 사용.
- 입력의 tech_stack / structure_summary / recent_commits / description 에 없는 기능은 절대 만들지 말 것.
- readme_reliability 가 "low" 또는 "missing" 이면 표현을 한 단계 더 보수적으로.

[필드별 고정 규칙]
- repo_name: 입력 repo_name 을 그대로 사용. 변형 금지.
- project_summary:
  - 정확히 1문장, 80자 이내.
  - "구조와 설정 파일 기준 ~ 으로 추정되는 프로젝트입니다" 형식 권장.
- core_features:
  - 정확히 3개. 단, 입력에서 근거를 찾을 수 없으면 빈 배열 가능.
  - 각 항목 20자 이내, 명사형 문구 ("알림 센터", "검색 필터", "차트 시각화" 등).
- portfolio_sentence:
  - 정확히 1문장, 100자 이내.
  - 반드시 "...을 구현했습니다" 또는 "...을 다뤘습니다" 로 끝낼 것.
  - 가능하면 입력 tech_stack 중 2개까지 포함.
- resume_bullets:
  - 정확히 3개. 각 60자 이내.
  - 동사 종결 화이트리스트에서만 선택: "구현했음" / "구성했음" / "정리했음" / "작성했음" / "분석했음" / "추가했음".
  - 단정 표현 금지 ("개발자임" 등).
- interview_questions:
  - 정확히 2개. 각 60자 이내.
  - 형식: "~을(를) 어떻게 ~?" 또는 "~에 대해 설명해 주세요." 중 하나로 끝낼 것.
  - 입력 데이터로 답할 수 있는 질문만.
- confidence:
  - 입력 readme_reliability 가 "high" 면 "high" 또는 "medium" 중 선택.
  - "medium" 이면 "medium" 또는 "low".
  - "low" / "missing" 이면 "low" 또는 "missing".

[예시 응답]
입력 예: { "repos": [ { "repo_name":"focusdash", "description":"productivity dashboard", "readme_reliability":"medium", "languages":["TypeScript"], "tech_stack":["Next.js","React","Tailwind CSS","Zustand"], "structure_summary":["src/app","components","shared","store"], "recent_commits":["feat: add notification popover","refactor: move header to layout","fix: toast UI rendering issue"], "inference_notes":["설정 파일 기준 프론트엔드 웹앱으로 추정"] } ] }
출력 예: {"reports":[{"repo_name":"focusdash","project_summary":"구조와 설정 파일 기준 Next.js 기반 생산성 대시보드 웹앱으로 추정되는 프로젝트입니다.","core_features":["알림 센터","대시보드 화면","상태 관리"],"portfolio_sentence":"Next.js 와 Zustand 를 활용해 생산성 대시보드의 주요 UI 와 상태 관리 구조를 구현했습니다.","resume_bullets":["대시보드형 생산성 웹앱의 프론트엔드 화면을 구현했음","알림 센터 컴포넌트와 라우팅 구조를 구성했음","공용 컴포넌트와 상태 store 폴더 구조를 정리했음"],"interview_questions":["상태 관리 라이브러리로 Zustand 를 선택한 이유에 대해 설명해 주세요.","알림 센터 UI 구조를 어떻게 분리했나요?"],"confidence":"medium"}]}`;

// === 호출 헬퍼 ===
// Mindlogic 게이트웨이는 OpenAI 호환 Chat Completions 스펙을 따른다.
//   POST {BASE_URL}/chat/completions
//   Authorization: Bearer ${MINDLOGIC_API_KEY}
// 모델 ID 는 model 필드로 전달하며 게이트웨이가 각 백엔드(OpenAI / Claude / Gemini)로 라우팅한다.
async function callGateway(
  systemPrompt: string,
  stableUserPayload: string,
  seed: number,
): Promise<string | null> {
  const apiKey = process.env.MINDLOGIC_API_KEY;
  if (!apiKey) return null;

  try {
    // 게이트웨이 뒷단 모델별 호환성 메모:
    //   - response_format: OpenAI 는 json_object, Anthropic 은 json_schema 형식이라 형식이 달라 → 보내지 않는다.
    //     system prompt 의 "JSON 만 출력" 지시 + tryParseJson 의 코드 블록 fallback 으로 처리.
    //   - top_p + temperature: Anthropic 계열은 둘 다 보내면 400 을 반환한다.
    //     ("`temperature` and `top_p` cannot both be specified for this model")
    //     재현성에서 가장 중요한 temperature 만 남긴다.
    //   - frequency_penalty / presence_penalty: Anthropic 미지원 → 제거.
    //   - seed: OpenAI 계열에서만 반영. Claude/Gemini 는 무시하지만 거절하지는 않아 안전하게 보낸다.
    //     무시되더라도 다른 결정성 장치(temperature=0, 화이트리스트, stableStringify) 가 어휘/구조를 잡아준다.
    const response = await fetch(`${GATEWAY_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GATEWAY_MODEL,
        temperature: LLM_TEMPERATURE,
        seed,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: stableUserPayload },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error(`[llm] Gateway ${response.status} ${errorText.slice(0, 200)}`);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("[llm] Gateway request failed", error);
    return null;
  }
}

async function callProvider(
  provider: LlmProvider,
  systemPrompt: string,
  payload: object,
  seedSalt: string,
): Promise<string | null> {
  if (provider !== "gateway") return null;
  const stableInput = stableStringify(payload);
  const seed = deterministicSeed(stableInput, `${PROMPT_VERSION}|${seedSalt}`);
  return callGateway(systemPrompt, stableInput, seed);
}

// 모델이 system prompt 를 따르지 않고 다음과 같이 응답하는 경우를 모두 흡수한다.
//   - ```json\n{...}\n```
//   - "Here is the JSON:\n{...}"
//   - {...} (정상)
function tryParseJson<T>(text: string | null): T | null {
  if (!text) return null;

  const trimmed = text.trim();
  // 1) 그대로 파싱 시도
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // pass
  }

  // 2) ```json ... ``` 코드 블록 제거 후 재시도
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      // pass
    }
  }

  // 3) 첫 "{" 부터 마지막 "}" 까지 잘라내 재시도 (그리디 매칭)
  const objMatch = trimmed.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0]) as T;
    } catch {
      return null;
    }
  }

  return null;
}

// === 외부 노출 함수 ===
export async function generateUserReport(
  provider: LlmProvider,
  payload: UserReportInput,
): Promise<LLMUserReport | null> {
  if (provider === "none") return null;
  const text = await callProvider(provider, USER_SYSTEM_PROMPT, payload, "user-report");
  const parsed = tryParseJson<LLMUserReport>(text);
  if (!parsed) return null;

  // 필수 필드 보정
  return {
    headline: typeof parsed.headline === "string" ? parsed.headline : "",
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  };
}

export async function generateRepoReports(
  provider: LlmProvider,
  payload: RepoReportInput[],
): Promise<LLMRepoReport[] | null> {
  if (provider === "none" || payload.length === 0) return null;
  const text = await callProvider(provider, REPO_SYSTEM_PROMPT, { repos: payload }, "repo-reports");
  const parsed = tryParseJson<{ reports?: LLMRepoReport[] }>(text);
  if (!parsed || !Array.isArray(parsed.reports)) return null;

  return parsed.reports.map((report) => ({
    repo_name: report.repo_name,
    project_summary: report.project_summary ?? "",
    core_features: Array.isArray(report.core_features) ? report.core_features.slice(0, 5) : [],
    portfolio_sentence: report.portfolio_sentence ?? "",
    resume_bullets: Array.isArray(report.resume_bullets) ? report.resume_bullets.slice(0, 5) : [],
    interview_questions: Array.isArray(report.interview_questions)
      ? report.interview_questions.slice(0, 4)
      : [],
    confidence: report.confidence ?? "low",
  }));
}
