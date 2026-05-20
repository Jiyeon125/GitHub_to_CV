// 분석 오케스트레이션
// - 수집(github.ts) → 점수화(scoring.ts) → deep 분석 모듈들 → LLM(llm.ts) → 응답 페이로드 변환
// - 라우트는 입력 검증/rate limit만 책임지고 이 파일을 호출한다.
// - 각 단계에서 발생한 부분적 실패는 warnings에 누적해 UI에 표시한다.

import {
  GitHubApiError,
  fetchAllUserRepos,
  fetchDeepRepoData,
  fetchUserProfile,
} from "./github";
import {
  computeShallowScore,
  computeRepoScore,
  getLanguageDistribution,
  getTopLanguage,
  refineScoreWithDeepData,
  type ScoredRepo,
} from "./scoring";
import { evaluateReadmeReliability } from "./readmeReliability";
import { extractRepoTechStack, aggregateTechStackDistribution } from "./techStack";
import {
  aggregateDomainScores,
  scoreRepoForDomains,
} from "./domainScores";
import { analyzeActivityPattern } from "./activityPattern";
import { buildTagCandidates } from "./tags";
import {
  buildRepoReportInputs,
  buildUserReportInput,
  detectLlmProvider,
  generateRepoReports,
  generateUserReport,
} from "./llm";
import type {
  AnalyzeOptions,
  AnalyzeResponse,
  AnalyzedRepo,
  DeepRepoData,
  GitHubRepo,
  LLMRepoReport,
} from "./types";

const MIN_REPRESENTATIVE = 3;
const MAX_REPRESENTATIVE = 5;

function clampCount(value: number): number {
  if (Number.isNaN(value)) return MIN_REPRESENTATIVE;
  return Math.min(MAX_REPRESENTATIVE, Math.max(MIN_REPRESENTATIVE, Math.floor(value)));
}

// 비-fork & description 있는 repo 우선, 부족하면 fork 포함
function pickRepresentativeCandidates(repos: GitHubRepo[], count: number): ScoredRepo[] {
  const scored: ScoredRepo[] = repos.map((repo) => {
    const { score, breakdown } = computeShallowScore(repo);
    const { legacyScore } = computeRepoScore(repo);
    return {
      ...repo,
      score,
      legacyScore,
      scoreBreakdown: breakdown,
      hasReadme: false,
      hasStructure: false,
    };
  });

  const nonForks = scored.filter((r) => !r.fork).sort((a, b) => b.score - a.score);
  const forks = scored.filter((r) => r.fork).sort((a, b) => b.score - a.score);
  const ordered = [...nonForks, ...forks];

  return ordered.slice(0, count);
}

// 단일 repo deep 분석을 AnalyzedRepo로 변환
function buildAnalyzedRepo(base: ScoredRepo, deep: DeepRepoData | null): AnalyzedRepo {
  const readmeReliability = evaluateReadmeReliability(deep?.readmeText ?? null, deep);
  const techStack = extractRepoTechStack(base, deep);

  const rootEntryCount = deep?.rootTree.length ?? 0;
  const refined = refineScoreWithDeepData(base, {
    hasReadme: !!deep?.readmeText,
    rootEntryCount,
  });

  const structureSummary = (deep?.rootTree ?? [])
    .filter((e) => e.type === "tree")
    .map((e) => e.path)
    .slice(0, 12);

  const recentCommitMessages = (deep?.commits ?? []).map((c) => c.message).filter(Boolean);

  // 규칙 기반 추론 메모: 어떤 신호를 가지고 어떤 결론을 냈는지 LLM에 전달하는 단서.
  // 표현은 "추정" 형태로 통일한다.
  const inferenceNotes: string[] = [];
  if (techStack.some((s) => ["React", "Next.js", "Vue", "Nuxt", "Svelte"].includes(s))) {
    inferenceNotes.push("설정 파일 기준 프론트엔드 웹앱으로 추정");
  }
  if (techStack.some((s) => ["FastAPI", "Django", "Flask", "Express", "NestJS", "Spring Boot"].includes(s))) {
    inferenceNotes.push("백엔드 API/서버 코드로 추정");
  }
  if (techStack.some((s) => ["pandas", "scikit-learn", "PyTorch", "TensorFlow", "Jupyter"].includes(s))) {
    inferenceNotes.push("데이터 분석 / ML 프로젝트일 가능성");
  }
  if (techStack.some((s) => ["Flutter", "React Native", "Expo", "Mobile Native"].includes(s))) {
    inferenceNotes.push("모바일 앱 프로젝트일 가능성");
  }
  if (techStack.includes("Docker") || techStack.includes("GitHub Actions")) {
    inferenceNotes.push("CI/CD 또는 배포 환경 구성 흔적");
  }
  if (rootEntryCount === 0) {
    inferenceNotes.push("루트 트리 정보를 가져오지 못해 구조 분석 신뢰도 낮음");
  }

  const analysisConfidence: AnalyzedRepo["analysisConfidence"] =
    readmeReliability.level === "missing"
      ? "low"
      : rootEntryCount === 0
        ? "low"
        : readmeReliability.level;

  return {
    ...refined,
    readmeReliability,
    techStack,
    structureSummary,
    recentCommitMessages,
    inferenceNotes,
    analysisConfidence,
  };
}

// === 메인 진입점 ===
export async function runAnalyze(options: AnalyzeOptions): Promise<AnalyzeResponse> {
  const representativeCount = clampCount(options.representativeCount);
  const username = options.username.trim();
  const warnings: string[] = [];

  let profile;
  try {
    profile = await fetchUserProfile(username);
  } catch (error) {
    if (error instanceof GitHubApiError) throw error;
    throw new GitHubApiError(502, "GitHub 사용자 정보를 가져오지 못했습니다.", String(error));
  }

  let repos: GitHubRepo[];
  try {
    repos = await fetchAllUserRepos(username, (message) => warnings.push(message));
  } catch (error) {
    if (error instanceof GitHubApiError) throw error;
    repos = [];
    warnings.push("GitHub API 호출 중 일부 저장소를 불러오지 못했습니다.");
  }

  if (repos.length === 0) {
    const empty: AnalyzeResponse = {
      username,
      profileUrl: profile.html_url,
      publicRepos: profile.public_repos,
      selectedRepos: [],
      topLanguage: "Unknown",
      languageDistribution: [],
      techStackDistribution: [],
      domainScores: {
        frontend: 0,
        backend: 0,
        data_ml: 0,
        mobile: 0,
        devops: 0,
        collaboration: 0,
      },
      activityPattern: {
        night_ratio: 0,
        morning_ratio: 0,
        weekend_ratio: 0,
        consistency_score: 0,
        commit_sample_size: 0,
        activity_tags: ["공개 repo 정보 부족"],
      },
      topTagsCandidates: [],
      warnings: ["분석 가능한 공개 저장소가 부족합니다."],
      llm: null,
      llmEnabled: options.useLlm,
      llmProvider: detectLlmProvider(),
      summary: `${username} 사용자의 공개 저장소가 없어 분석을 진행할 수 없습니다.`,
      generatedAt: new Date().toISOString(),
      cached: false,
    };
    return empty;
  }

  const onlyForks = repos.every((r) => r.fork);
  if (onlyForks) {
    warnings.push("fork 저장소만 공개되어 있어 분석 신뢰도가 낮을 수 있습니다.");
  }

  // === 대표 repo 선정 (shallow 점수 기준) ===
  const candidates = pickRepresentativeCandidates(repos, representativeCount);

  // === 2차 deep collection (대표 repo에 한해 병렬 수집) ===
  const deepResults = await Promise.all(
    candidates.map(async (repo) => {
      try {
        const data = await fetchDeepRepoData(username, repo.name, repo.default_branch ?? "main");
        return { id: repo.id, data };
      } catch (error) {
        console.error(`[analyze] deep fetch failed for ${repo.name}`, error);
        warnings.push(`${repo.name}: 일부 데이터 수집에 실패했습니다.`);
        return { id: repo.id, data: null as DeepRepoData | null };
      }
    }),
  );

  const deepMap = new Map<number, DeepRepoData | null>();
  for (const { id, data } of deepResults) deepMap.set(id, data);

  // === 분석된 repo 객체 만들기 ===
  let selectedRepos: AnalyzedRepo[] = candidates.map((repo) =>
    buildAnalyzedRepo(repo, deepMap.get(repo.id) ?? null),
  );

  // refine 후 score가 바뀌므로 한 번 더 정렬
  selectedRepos.sort((a, b) => b.score - a.score);

  // === 도메인 점수 (사용자 전체) ===
  const perRepoDomain = selectedRepos.map((repo) =>
    scoreRepoForDomains(repo, repo.techStack, deepMap.get(repo.id) ?? null, repo.readmeReliability),
  );
  const domainScores = aggregateDomainScores(perRepoDomain);

  // === 활동 패턴 ===
  const commitsByRepo = selectedRepos.map((repo) => deepMap.get(repo.id)?.commits ?? []);
  const activityPattern = analyzeActivityPattern(commitsByRepo);

  // === 기술 스택 분포 / 언어 분포 ===
  const techStackDistribution = aggregateTechStackDistribution(
    selectedRepos.map((r) => r.techStack),
  );
  const languageDistribution = getLanguageDistribution(repos);
  const topLanguage = getTopLanguage(repos);

  // === 태그 후보 ===
  const topTagsCandidates = buildTagCandidates(domainScores, activityPattern, techStackDistribution);

  // === README 신뢰도 낮은 repo가 다수면 경고 추가 ===
  const lowReadmeCount = selectedRepos.filter(
    (r) => r.readmeReliability.level === "low" || r.readmeReliability.level === "missing",
  ).length;
  if (lowReadmeCount >= Math.ceil(selectedRepos.length / 2)) {
    warnings.push("README와 commit 정보가 부족하여 일부 결과는 추정 기반입니다.");
  }

  // === LLM 호출 (옵션) ===
  let llmReport: AnalyzeResponse["llm"] = null;
  const provider = detectLlmProvider();
  let llmAvailable = options.useLlm && provider !== "none";

  if (options.useLlm && provider === "none") {
    warnings.push("LLM API 키가 없어 규칙 기반 분석 결과만 표시합니다.");
  }

  if (llmAvailable) {
    try {
      const userInput = buildUserReportInput({
        username,
        publicRepos: profile.public_repos,
        topLanguages: languageDistribution.map((l) => l.language),
        domainScores,
        activity: activityPattern,
        topTags: topTagsCandidates,
        selectedRepos,
      });

      const repoInputs = buildRepoReportInputs(selectedRepos);

      const [userReport, repoReports] = await Promise.all([
        generateUserReport(provider, userInput),
        generateRepoReports(provider, repoInputs),
      ]);

      if (userReport) {
        llmReport = userReport;
      } else {
        warnings.push("LLM 사용자 요약 생성에 실패하여 규칙 기반 결과만 표시합니다.");
      }

      if (repoReports) {
        const byName = new Map<string, LLMRepoReport>();
        for (const r of repoReports) byName.set(r.repo_name, r);
        selectedRepos = selectedRepos.map((repo) => ({
          ...repo,
          llm: byName.get(repo.name) ?? null,
        }));
      } else {
        warnings.push("LLM repo 요약 생성에 실패하여 규칙 기반 결과만 표시합니다.");
      }
    } catch (error) {
      console.error("[analyze] LLM stage failed", error);
      warnings.push("LLM 호출 중 오류가 발생했습니다.");
      llmAvailable = false;
    }
  }

  // LLM 요약이 없을 때 보여줄 규칙 기반 fallback 문장.
  // 단정 표현 대신 "공개 저장소 기준 추정" 임을 명시한다.
  const summary =
    llmReport?.summary ||
    `${username} 사용자의 공개 저장소 ${profile.public_repos}개 중 대표 ${selectedRepos.length}개를 분석한 추정 결과입니다. 주 언어는 ${topLanguage}로 관찰됩니다.`;

  return {
    username,
    profileUrl: profile.html_url,
    publicRepos: profile.public_repos,
    selectedRepos,
    topLanguage,
    languageDistribution,
    techStackDistribution,
    domainScores,
    activityPattern,
    topTagsCandidates,
    warnings,
    llm: llmReport,
    llmEnabled: llmAvailable,
    llmProvider: provider,
    summary,
    generatedAt: new Date().toISOString(),
    cached: false,
  };
}
