// LLM 통합 (OpenAI / Gemini 선택적 호출)
// - 호출은 최소화: 사용자 리포트 1회, repo 분석 1회 (한 프롬프트로 N개 묶음).
// - JSON 응답이 깨지면 fallback 텍스트로 변환해 UI가 항상 무엇이든 보여줄 수 있도록 한다.
// - LLM 키가 없으면 provider = "none" 으로 두고 호출을 생략한다.

import type {
  ActivityPattern,
  AnalyzedRepo,
  DomainScores,
  LLMRepoReport,
  LLMUserReport,
} from "./types";

export type LlmProvider = "openai" | "gemini" | "none";

const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";

export function detectLlmProvider(): LlmProvider {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "none";
}

// === 입력 페이로드 빌더 (LLM 토큰 절약을 위해 요약형 데이터만 전달) ===
export type UserReportInput = {
  username: string;
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
  publicRepos: number;
  topLanguages: string[];
  domainScores: DomainScores;
  activity: ActivityPattern;
  topTags: string[];
  selectedRepos: AnalyzedRepo[];
}): UserReportInput {
  return {
    username: opts.username,
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

// === 프롬프트 ===
const USER_SYSTEM_PROMPT = `당신은 개발자의 GitHub 공개 저장소 분석 결과를 정리해 한국어 리포트 헤드라인과 요약을 작성하는 분석가입니다.
입력으로 받은 통계와 태그 후보만 근거로 사용하고, 추측이나 과장은 피하세요.
응답은 반드시 다음 JSON 스키마만 출력합니다. 마크다운 코드 블록, 설명 문장, 주석은 모두 금지합니다.
{
  "headline": string,
  "summary": string,
  "tags": [{ "name": string, "reason": string }],
  "warnings": string[]
}
표현 원칙 (매우 중요):
- 단정 금지: "프론트엔드 개발자입니다", "야간형 개발자입니다" 같은 표현 사용 금지.
- 대신 "공개 저장소 기준 ~ 비중이 높게 나타납니다", "~ 경향이 관찰됩니다" 같이 추정형으로 작성.
- 입력 데이터에 없는 사실을 만들지 말 것. 회사명, 학력, 경력 등은 절대 추가 금지.
- 모든 결과가 공개 repository 데이터에 한정된 추정임을 헤드라인이나 요약에서 인지 가능하게 표현.
세부 규칙:
- headline: 1문장, 60자 이하. "~한 활동 경향을 보이는 개발자" 또는 "~이 두드러지는 GitHub 활동 프로필" 같은 형태.
- summary: 2~4문장. 도메인 비중, 기술 스택, 활동 경향을 추정형으로 요약.
- tags: 입력의 top_tags_candidates 중 최대 4개를 골라 사용. name은 그대로 사용하고 reason은 한 문장으로 근거 제시.
- warnings: 공개 저장소 기준이라는 점, README/표본 부족 등 신뢰도가 낮은 영역이 있다면 명시. 없으면 빈 배열.`;

const REPO_SYSTEM_PROMPT = `당신은 GitHub 공개 저장소 분석 결과를 이력서/포트폴리오용 한국어 문장으로 정리하는 작가입니다.
입력 데이터만 근거로 사용하고 코드를 추측하지 마세요.
입력은 repo 목록입니다. 각 repo 에 대해 다음 JSON 스키마로 응답하세요. 마크다운/설명 문장 금지.
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
표현 원칙 (매우 중요):
- "~프로젝트입니다"와 같이 단정하지 말고 "~로 추정되는 프로젝트" 같이 표현.
- 입력의 tech_stack / structure_summary / recent_commits 에서 직접 확인되지 않는 기능은 만들지 말 것.
- 입력의 readme_reliability 가 "low" 또는 "missing" 이면 표현을 더 보수적으로.
세부 규칙:
- project_summary: 1~2문장. "구조와 설정 파일 기준 ~ 으로 추정" 형태 권장.
- core_features: 최대 4개. 입력에서 근거 찾을 수 있는 기능만. 근거가 약하면 빈 배열도 허용.
- portfolio_sentence: 1문장. "~을 구현했습니다" 또는 "~을 다뤘습니다" 같은 형태로, 추정형 어휘 사용.
- resume_bullets: 3~4개. 각 60자 이내. 동사로 시작하되 단정 표현은 피하고 "구현", "구성", "정리" 등 사용.
- interview_questions: 2~3개. 입력 데이터로 답변 가능한 질문 중심.
- confidence: 입력의 readme_reliability 를 그대로 또는 한 단계 낮춰 보수적으로 결정.`;

// === 호출 헬퍼 ===
async function callOpenAI(systemPrompt: string, userPayload: object): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userPayload) },
        ],
      }),
    });
    if (!response.ok) {
      console.error(`[llm] OpenAI ${response.status}`);
      return null;
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } catch (error) {
    console.error("[llm] OpenAI request failed", error);
    return null;
  }
}

async function callGemini(systemPrompt: string, userPayload: object): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(userPayload) }] }],
          generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
        }),
      },
    );
    if (!response.ok) {
      console.error(`[llm] Gemini ${response.status}`);
      return null;
    }
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  } catch (error) {
    console.error("[llm] Gemini request failed", error);
    return null;
  }
}

async function callProvider(provider: LlmProvider, systemPrompt: string, payload: object): Promise<string | null> {
  if (provider === "openai") return callOpenAI(systemPrompt, payload);
  if (provider === "gemini") return callGemini(systemPrompt, payload);
  return null;
}

function tryParseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    // 모델이 ```json ``` 으로 감싼 경우를 대비
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

// === 외부 노출 함수 ===
export async function generateUserReport(
  provider: LlmProvider,
  payload: UserReportInput,
): Promise<LLMUserReport | null> {
  if (provider === "none") return null;
  const text = await callProvider(provider, USER_SYSTEM_PROMPT, payload);
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
  const text = await callProvider(provider, REPO_SYSTEM_PROMPT, { repos: payload });
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
