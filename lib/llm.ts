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

export type LlmProvider = "gateway" | "custom" | "none";

// UI 사이드바에서 그대로 사용할 모델 프리셋 목록.
// - 의도적으로 mini/nano/flash 같은 경량 모델은 빼고, 컨텍스트 이해가 잘 되는 동급 상위 모델만 노출한다.
// - 라벨/설명만 바꾸려면 이 배열만 수정하면 된다.
export const LLM_MODEL_PRESETS: ReadonlyArray<{
  id: "gateway-gpt" | "gateway-claude" | "gateway-gemini";
  label: string;
  description: string;
}> = [
  {
    id: "gateway-gpt",
    label: "OpenAI GPT (gpt-5)",
    description: "재현성·JSON 안정성 우선. 기본 추천.",
  },
  {
    id: "gateway-claude",
    label: "Anthropic Claude Sonnet",
    description: "한국어 문장의 자연스러움이 강점.",
  },
  {
    id: "gateway-gemini",
    label: "Google Gemini 2.5 Pro",
    description: "긴 컨텍스트와 속도 균형.",
  },
];

// 사용자가 사이드바에서 고를 수 있는 모델 프리셋.
// - "gateway-*" : 서버에 등록된 MINDLOGIC_API_KEY 로 게이트웨이를 거쳐 호출 (사용자 키 불필요)
// - "custom"    : 사용자가 직접 OpenAI 호환 API key/base URL/model 을 입력해 호출
export type LlmModelChoice =
  | "gateway-gpt"
  | "gateway-claude"
  | "gateway-gemini"
  | "custom";

// 사이드바 / API 요청에서 함께 전달되는 LLM 설정.
// - choice 는 프리셋 식별자
// - custom 일 때만 apiKey/baseUrl/model 이 필요
export type LlmConfig = {
  choice: LlmModelChoice;
  // custom 모드 한정 입력값. 그 외에는 무시한다.
  apiKey?: string | null;
  baseUrl?: string | null;
  model?: string | null;
};

const DEFAULT_GATEWAY_BASE_URL = "https://factchat-cloud.mindlogic.ai/v1/gateway";

// 게이트웨이 프리셋 모델 ID.
// - nano/mini/flash 같은 경량 모델은 컨텍스트 이해가 약해 본 서비스 프롬프트(JSON 강제 + 화이트리스트)
//   에서 자주 깨지므로 의도적으로 제외하고, 한 단계 위 모델 ID 를 기본값으로 둔다.
// - 게이트웨이가 지원하는 정확한 모델 ID 가 다르면 환경 변수 MINDLOGIC_MODEL_GPT / _CLAUDE / _GEMINI
//   로 손쉽게 재정의할 수 있도록 했다.
// - 2026-05 기준 Mindlogic 게이트웨이가 노출하는 OpenAI 모델은 gpt-5.x 시리즈이며 gpt-4o 는 권한 거부됨.
//   따라서 기본값을 컨텍스트 이해가 잘 되는 gpt-5.4 로 둔다.
const GATEWAY_MODEL_GPT = process.env.MINDLOGIC_MODEL_GPT ?? "gpt-5.4";
const GATEWAY_MODEL_CLAUDE = process.env.MINDLOGIC_MODEL_CLAUDE ?? "claude-sonnet-4-6";
const GATEWAY_MODEL_GEMINI = process.env.MINDLOGIC_MODEL_GEMINI ?? "gemini-2.5-pro";

// 하위 호환: 단일 MINDLOGIC_MODEL 환경 변수가 지정돼 있으면 그 값으로 GPT 프리셋을 덮는다.
const LEGACY_GATEWAY_MODEL = process.env.MINDLOGIC_MODEL;
const RESOLVED_GATEWAY_MODELS: Record<"gateway-gpt" | "gateway-claude" | "gateway-gemini", string> = {
  "gateway-gpt": LEGACY_GATEWAY_MODEL ?? GATEWAY_MODEL_GPT,
  "gateway-claude": GATEWAY_MODEL_CLAUDE,
  "gateway-gemini": GATEWAY_MODEL_GEMINI,
};

const GATEWAY_BASE_URL = (process.env.MINDLOGIC_BASE_URL ?? DEFAULT_GATEWAY_BASE_URL).replace(/\/+$/, "");

// 환경 변수로 미세 조정 가능하지만, 기본값은 재현성 최우선으로 0 에 가깝게 둔다.
// 잘못된 문자열이 들어오면 NaN 이 모델 측 400 오류를 유발하므로 안전 가드를 둔다.
function parseTemperature(): number {
  const raw = process.env.LLM_TEMPERATURE;
  if (!raw) return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(2, parsed));
}
const LLM_TEMPERATURE = parseTemperature();

// 프롬프트 버전. 프롬프트 본문 또는 호출 파라미터 형태가 바뀌면 이 문자열을 올려
// seed 와 캐시(buildAnalyzeCacheKey 는 별도지만 분석 결과 자체 캐시) 가 자동으로 무효화되도록 한다.
const PROMPT_VERSION = "v6-deeper-interview-2026-06-01";

// 내부적으로 실제 호출에 쓰이는 해석된 설정.
// - 외부 LlmConfig 와 환경 변수를 합쳐 만든다.
type ResolvedLlmCall = {
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
};

// 게이트웨이/커스텀 키 존재 여부만으로 LLM 사용 가능성을 판단한다.
// - config 가 custom 이고 키가 비어 있으면 "none" 으로 간주
// - config 가 gateway 계열이고 서버에 MINDLOGIC_API_KEY 가 없으면 "none"
export function detectLlmProviderFromConfig(config: LlmConfig | null | undefined): LlmProvider {
  if (!config) return process.env.MINDLOGIC_API_KEY ? "gateway" : "none";
  if (config.choice === "custom") {
    return config.apiKey && config.apiKey.trim() ? "custom" : "none";
  }
  return process.env.MINDLOGIC_API_KEY ? "gateway" : "none";
}

// 하위 호환: 옛 호출부에서 인자 없이 쓰던 시그니처도 유지한다.
export function detectLlmProvider(config?: LlmConfig | null): LlmProvider {
  return detectLlmProviderFromConfig(config ?? null);
}

function resolveLlmCall(config: LlmConfig | null | undefined): ResolvedLlmCall | null {
  if (!config || config.choice !== "custom") {
    const key = process.env.MINDLOGIC_API_KEY;
    if (!key) return null;
    const choice =
      (config?.choice as keyof typeof RESOLVED_GATEWAY_MODELS | undefined) ?? "gateway-gpt";
    const model =
      choice in RESOLVED_GATEWAY_MODELS
        ? RESOLVED_GATEWAY_MODELS[choice as keyof typeof RESOLVED_GATEWAY_MODELS]
        : RESOLVED_GATEWAY_MODELS["gateway-gpt"];
    return {
      provider: "gateway",
      apiKey: key,
      baseUrl: GATEWAY_BASE_URL,
      model,
    };
  }

  const apiKey = (config.apiKey ?? "").trim();
  if (!apiKey) return null;
  const baseUrl = (config.baseUrl ?? "").trim() || "https://api.openai.com/v1";
  const model = (config.model ?? "").trim() || "gpt-4o";
  return {
    provider: "custom",
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
  };
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

// 잡무성 commit(빌드/포맷/문서/CI/의존성 등)은 이력서 문장과 면접질문을 피상적으로 만들기 쉽다.
// 기능/수정/리팩터/성능 같은 의미 있는 변경을 우선 노출하고, 전부 걸러지면 원본을 사용한다.
const TRIVIAL_COMMIT_RE =
  /^(chore|ci|build|docs?|test|style|format|lint|bump|release|revert|merge)\b|^(merge\s|bump\s|update\s+deps|dependabot)/i;

function selectMeaningfulCommits(messages: string[]): string[] {
  const meaningful = messages.filter((m) => !TRIVIAL_COMMIT_RE.test(m.trim()));
  return (meaningful.length > 0 ? meaningful : messages).slice(0, 6);
}

export function buildRepoReportInputs(repos: AnalyzedRepo[]): RepoReportInput[] {
  return repos.map((repo) => ({
    repo_name: repo.name,
    description: repo.description,
    readme_reliability: repo.readmeReliability.level,
    languages: repo.language ? [repo.language] : [],
    tech_stack: repo.techStack,
    structure_summary: repo.structureSummary.slice(0, 8),
    recent_commits: selectMeaningfulCommits(repo.recentCommitMessages),
    inference_notes: repo.inferenceNotes,
  }));
}

// === stable serialization & seed ===
// 객체 key 순서, 배열 순서를 가능한 한 결정적으로 만들기 위해 직접 작성한 직렬화.
// 배열 순서가 의미를 가지는 경우(commit 순서 등)는 그대로 두고, key 순서만 알파벳 순으로 정렬한다.
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

// OpenAI seed 는 부호 있는 32-bit 정수 권장. 단순 djb2 변형으로 결정적 해시 생성.
export function deterministicSeed(stableInput: string, salt: string): number {
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
  - 정확히 2개. 각 80자 이내.
  - 실제 기술 면접에서 나올 법한 심화 질문으로 작성: 기술 선택의 이유·트레이드오프, 설계/아키텍처 결정, 성능·확장성·테스트·에러 처리 전략 등.
  - tech_stack / structure_summary / 도메인 신호에 근거하되, recent_commits 나 resume_bullets 문구를 그대로 되묻지 말 것 (단순 사실 확인 질문 금지).
  - 입력에 없는 기능·기술은 가정하지 말 것. 근거가 약하면 일반적인 설계 질문으로 작성.
  - "~ 이유는 무엇인가요?" / "~ 어떻게 설계했나요?" / "~ 에 대해 설명해 주세요." 중 하나로 끝낼 것.
- confidence:
  - 입력 readme_reliability 가 "high" 면 "high" 또는 "medium" 중 선택.
  - "medium" 이면 "medium" 또는 "low".
  - "low" / "missing" 이면 "low" 또는 "missing".

[예시 응답]
입력 예: { "repos": [ { "repo_name":"focusdash", "description":"productivity dashboard", "readme_reliability":"medium", "languages":["TypeScript"], "tech_stack":["Next.js","React","Tailwind CSS","Zustand"], "structure_summary":["src/app","components","shared","store"], "recent_commits":["feat: add notification popover","refactor: move header to layout","fix: toast UI rendering issue"], "inference_notes":["설정 파일 기준 프론트엔드 웹앱으로 추정"] } ] }
출력 예: {"reports":[{"repo_name":"focusdash","project_summary":"구조와 설정 파일 기준 Next.js 기반 생산성 대시보드 웹앱으로 추정되는 프로젝트입니다.","core_features":["알림 센터","대시보드 화면","상태 관리"],"portfolio_sentence":"Next.js 와 Zustand 를 활용해 생산성 대시보드의 주요 UI 와 상태 관리 구조를 구현했습니다.","resume_bullets":["대시보드형 생산성 웹앱의 프론트엔드 화면을 구현했음","알림 센터 컴포넌트와 라우팅 구조를 구성했음","공용 컴포넌트와 상태 store 폴더 구조를 정리했음"],"interview_questions":["전역 상태 관리로 Context API 가 아닌 Zustand 를 택한 이유와 트레이드오프는 무엇인가요?","위젯이 늘어나는 대시보드에서 상태 구조와 리렌더링 성능을 어떻게 설계하셨나요?"],"confidence":"medium"}]}`;

// === 호출 헬퍼 ===
// OpenAI 호환 Chat Completions 스펙을 따르는 엔드포인트를 모두 같은 함수로 호출한다.
//   POST {baseUrl}/chat/completions
//   Authorization: Bearer ${apiKey}
// Mindlogic 게이트웨이, 사용자 직접 입력한 OpenAI / Anthropic 호환 base URL 모두 이 함수를 사용한다.

// 모델 ID 패턴으로 seed 지원 여부를 추정한다.
// - Gemini 의 OpenAI 호환 엔드포인트는 'seed' 필드를 모르고 400 으로 거절한다.
//   ("Invalid JSON payload received. Unknown name 'seed': Cannot find field.")
// - 그 외 (OpenAI / Claude / 사용자 지정) 는 seed 를 보내도 안전하다.
//   OpenAI 는 실제로 반영, Claude 는 무시만 함.
function modelLikelySupportsSeed(model: string): boolean {
  return !/gemini/i.test(model);
}

type CallParams = {
  withSeed: boolean;
};

async function sendChatCompletion(
  call: ResolvedLlmCall,
  systemPrompt: string,
  stableUserPayload: string,
  seed: number,
  params: CallParams,
): Promise<Response> {
  const body: Record<string, unknown> = {
    model: call.model,
    temperature: LLM_TEMPERATURE,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: stableUserPayload },
    ],
  };
  if (params.withSeed) body.seed = seed;

  return fetch(`${call.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${call.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function callOpenAICompatible(
  call: ResolvedLlmCall,
  systemPrompt: string,
  stableUserPayload: string,
  seed: number,
): Promise<string | null> {
  try {
    // 모델별 호환성 메모:
    //   - response_format: OpenAI 는 json_object, Anthropic 은 json_schema 형식이라 형식이 달라 → 보내지 않는다.
    //     system prompt 의 "JSON 만 출력" 지시 + tryParseJson 의 코드 블록 fallback 으로 처리.
    //   - top_p + temperature: Anthropic 계열은 둘 다 보내면 400 을 반환한다.
    //     재현성에서 가장 중요한 temperature 만 남긴다.
    //   - frequency_penalty / presence_penalty: Anthropic 미지원 → 제거.
    //   - seed: OpenAI 계열에서만 반영. Gemini 는 명시적으로 400 으로 거절하므로 모델 패턴으로 미리 거른다.
    //     그래도 처음 보내는 모델이 거절하면 400 응답 본문에 'seed' 가 보이는지 확인해 한 번 더 재시도한다.
    const startWithSeed = modelLikelySupportsSeed(call.model);
    let response = await sendChatCompletion(call, systemPrompt, stableUserPayload, seed, {
      withSeed: startWithSeed,
    });

    if (!response.ok && response.status === 400 && startWithSeed) {
      const errorText = await response.text().catch(() => "");
      if (/seed/i.test(errorText)) {
        // 'seed' 필드를 모르는 모델일 가능성이 높다 → seed 빼고 한 번 더 시도
        console.warn(
          `[llm] ${call.provider}/${call.model} rejected seed; retrying without seed.`,
        );
        response = await sendChatCompletion(call, systemPrompt, stableUserPayload, seed, {
          withSeed: false,
        });
      } else {
        console.error(
          `[llm] ${call.provider}/${call.model} 400 ${errorText.slice(0, 200)}`,
        );
        return null;
      }
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      // 응답 본문에 API key 가 echo 되는 경우는 거의 없지만, 만약을 위해 200자 미만으로 잘라 로그.
      console.error(
        `[llm] ${call.provider}/${call.model} ${response.status} ${errorText.slice(0, 200)}`,
      );
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error(`[llm] ${call.provider}/${call.model} request failed`, error);
    return null;
  }
}

async function callProvider(
  config: LlmConfig | null | undefined,
  systemPrompt: string,
  payload: object,
  seedSalt: string,
): Promise<string | null> {
  const call = resolveLlmCall(config);
  if (!call) return null;
  const stableInput = stableStringify(payload);
  // seed 에는 모델 ID 도 섞어 같은 입력이라도 모델이 바뀌면 seed 가 달라지도록 한다.
  // (같은 모델 + 같은 입력 → 동일 seed, 모델만 바꿔도 캐시/seed 가 갈라지므로 비교 시연이 자연스럽다.)
  const seed = deterministicSeed(
    stableInput,
    `${PROMPT_VERSION}|${call.provider}|${call.model}|${seedSalt}`,
  );
  return callOpenAICompatible(call, systemPrompt, stableInput, seed);
}

// 모델이 system prompt 를 따르지 않고 다음과 같이 응답하는 경우를 모두 흡수한다.
//   - ```json\n{...}\n```
//   - "Here is the JSON:\n{...}"
//   - {...} (정상)
export function tryParseJson<T>(text: string | null): T | null {
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
  config: LlmConfig | null | undefined,
  payload: UserReportInput,
): Promise<LLMUserReport | null> {
  if (detectLlmProviderFromConfig(config) === "none") return null;
  const text = await callProvider(config, USER_SYSTEM_PROMPT, payload, "user-report");
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

// === 대표 repo 선정 리랭커 ===
// 규칙 기반으로 추린 후보 풀(보통 6~12개)을 받아 포트폴리오 관점에서 N 개를 LLM 이 고르도록 한다.
// - 입력은 메타데이터(이름/desc/언어/topics/별점/사이즈/recency/배포 URL/보관 여부) + (인증 호출 시) README 앞부분 스니펫.
//   전체 deep 데이터는 불필요하며, 본문은 짧은 스니펫만 보내 비용/할루시네이션을 억제한다.
// - 결정성을 위해 temperature=0, stableStringify(payload), seed=hash(prompt+payload+model) 그대로.
// - 응답은 강제 JSON: { "picks": [{ "name": string, "reason": string }] }
// - 실패/파싱 실패 시 null → 호출 측에서 규칙 기반 fallback 으로 그대로 진행.

export type RepoSelectionCandidate = {
  name: string;
  description: string | null;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  size: number | null;
  updated_at: string;
  pushed_at: string | null; // 실제 코드 push 시각 (updated_at 보다 정확한 최근성)
  is_fork: boolean;
  is_archived: boolean; // 보관/비활성 repo 여부
  homepage: string | null; // 배포 URL (있으면 실제 배포 신호)
  readme_excerpt: string | null; // README 앞부분 (인증 호출일 때만 채워짐, 없으면 null)
  rule_score: number; // 규칙 기반 점수 (참고용)
};

const SELECTION_SYSTEM_PROMPT = `당신은 GitHub 프로필을 이력서·포트폴리오 관점에서 평가하는 채용/커리어 리뷰어입니다.
주어진 후보 저장소 목록에서 "포트폴리오에 대표로 보여주기 가장 좋은" 저장소를 정확히 N 개 골라주세요.

[입력 형식]
{ "limit": number, "candidates": [{ "name", "description", "language", "topics", "stargazers_count", "size", "updated_at", "pushed_at", "is_fork", "is_archived", "homepage", "readme_excerpt", "rule_score" }, ...] }

[선정 원칙]
- 학습/튜토리얼/클론 코딩/빈 스캐폴드 보다 본인이 직접 설계·구현한 흔적이 있는 repo 를 선호.
- readme_excerpt(README 앞부분)가 있으면 실제 구현/설명의 충실도를 판단하는 데 적극 활용. 구체적 기능·설계 설명이 있으면 우대, 비어 있거나(null) 부실하면 신뢰도 신호를 낮게 본다.
- homepage(배포 URL)가 있으면 실제 배포까지 한 프로젝트로 보고 우대.
- is_archived=true(보관/비활성) repo 는 비선호.
- 같은 언어/도메인이 N 개 모두 겹치지 않도록 다양성을 약간 반영(언어/topic 이 다른 후보가 동률이면 가산).
- description / topics 가 충실한 repo 를 약간 선호.
- fork 는 description 이 본인 작성으로 보일 때만 고려.
- rule_score 는 참고 신호일 뿐 절대 기준이 아님. 위 원칙과 충돌하면 본인 판단을 우선.

[출력 형식 절대 규칙]
- 응답 전체는 유효한 JSON 객체 하나. "{" 로 시작 "}" 로 끝.
- 마크다운/설명/코드블록(\`\`\`) 금지. 위반 시 응답이 자동 폐기됨.
- 스키마:
  { "picks": [ { "name": string, "reason": string } ] }
  - picks.length 는 입력 limit 과 정확히 같아야 함. 부족하면 후순위라도 채워서 limit 을 맞추기.
  - 각 name 은 반드시 입력 candidates 중 하나와 정확히 일치. 새 이름 만들지 말 것.
  - reason 은 1문장, 60자 이내, 추정형 ("~ 신호가 있어 대표성이 높음" 등).`;

export async function rerankRepoSelection(
  config: LlmConfig | null | undefined,
  candidates: RepoSelectionCandidate[],
  limit: number,
): Promise<Array<{ name: string; reason: string }> | null> {
  if (detectLlmProviderFromConfig(config) === "none") return null;
  if (candidates.length === 0 || limit <= 0) return null;

  const text = await callProvider(
    config,
    SELECTION_SYSTEM_PROMPT,
    { limit, candidates },
    "repo-selection-v3",
  );
  const parsed = tryParseJson<{ picks?: Array<{ name?: string; reason?: string }> }>(text);
  if (!parsed || !Array.isArray(parsed.picks)) return null;

  // 입력에 존재하는 이름만 통과시킨다 (할루시네이션 방지).
  const validNames = new Set(candidates.map((c) => c.name));
  const seen = new Set<string>();
  const picks: Array<{ name: string; reason: string }> = [];
  for (const item of parsed.picks) {
    const name = typeof item?.name === "string" ? item.name : "";
    if (!validNames.has(name) || seen.has(name)) continue;
    seen.add(name);
    picks.push({
      name,
      reason: typeof item?.reason === "string" ? item.reason.slice(0, 120) : "",
    });
    if (picks.length >= limit) break;
  }

  return picks.length > 0 ? picks : null;
}

export async function generateRepoReports(
  config: LlmConfig | null | undefined,
  payload: RepoReportInput[],
): Promise<LLMRepoReport[] | null> {
  if (detectLlmProviderFromConfig(config) === "none" || payload.length === 0) return null;
  const text = await callProvider(config, REPO_SYSTEM_PROMPT, { repos: payload }, "repo-reports");
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
