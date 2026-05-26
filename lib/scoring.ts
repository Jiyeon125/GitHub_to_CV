// 점수화 모듈
// - PoC 단계에서 사용하던 computeRepoScore / rankRepresentativeRepos / getTopLanguage 는
//   기존 호환성을 위해 그대로 유지한다.
// - MVP 명세 가중치 (최근 업데이트 25 / description 15 / README 15 / 활동성 15 /
//   구조 20 / fork -10)를 반영하는 새 점수 함수가 추가됐다.
// - shallow 단계에서는 README/구조 정보가 없으므로 부분 점수만 계산하고,
//   deep 수집 후 refineScoreWithDeepData 로 두 항목을 채워 최종 순위를 재계산한다.

export type GitHubRepo = {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  fork: boolean;
  private?: boolean;
  topics?: string[];
  default_branch?: string;
  size?: number;
};

export type ScoreBreakdown = {
  // PoC 호환 필드 (UI/응답에서 직접 참조될 수 있어 그대로 둔다)
  nonFork: number;
  description: number;
  language: number;
  stars: number;
  forks: number;
  recency: number;
  // 명세 가중치 기반 신규 필드 (총합 0~100 범위)
  recencyWeighted: number;
  descriptionWeighted: number;
  readmeWeighted: number;
  activityWeighted: number;
  structureWeighted: number;
  forkPenalty: number;
  // 신호 보강 필드 (포트폴리오 신호 강화 / 노이즈 repo 페널티)
  topicsBonus: number; // repo.topics 가 비어 있지 않으면 가산점 (관리 의지 신호)
  tutorialPenalty: number; // 이름/description 이 학습용 패턴이면 감점
  sizePenalty: number; // 사실상 빈 repo (size 매우 작음) 감점
};

export type ScoredRepo = GitHubRepo & {
  score: number; // 최종 0~100 정규화 점수
  legacyScore: number; // PoC 호환용 (이전 계산 결과)
  scoreBreakdown: ScoreBreakdown;
  hasReadme: boolean;
  hasStructure: boolean; // 코드 구조가 비어 있지 않은지 (deep 수집 후 갱신됨)
};

const DAY = 1000 * 60 * 60 * 24;
const NOW_MS = () => Date.now();

// === PoC 호환: 기존 시그니처 유지 ===
export function computeRepoScore(repo: GitHubRepo) {
  const nonFork = repo.fork ? 0 : 20;
  const description = repo.description ? 10 : 0;
  const language = repo.language ? 10 : 0;
  const stars = Math.min(25, repo.stargazers_count);
  const forks = Math.min(15, repo.forks_count);

  const ageInDays = Math.max(0, (NOW_MS() - new Date(repo.updated_at).getTime()) / DAY);
  const recency = Math.max(0, 20 - Math.floor(ageInDays / 30));

  const legacyBreakdown = { nonFork, description, language, stars, forks, recency };
  const legacyScore = Object.values(legacyBreakdown).reduce((sum, v) => sum + v, 0);

  return { legacyScore, legacyBreakdown };
}

// === MVP 명세: 가중치 기반 점수 ===

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// 0~1 정규화된 최근성 (12개월 이상 미업데이트면 0)
function recencyFactor(updatedAt: string): number {
  const ageDays = Math.max(0, (NOW_MS() - new Date(updatedAt).getTime()) / DAY);
  if (ageDays <= 30) return 1;
  if (ageDays >= 365) return 0;
  return 1 - (ageDays - 30) / (365 - 30);
}

// star/fork 활동성: 0~1
function activityFactor(repo: GitHubRepo): number {
  // log scale로 완만하게: 10 star ≈ 0.7, 100 star ≈ 1.0
  const stars = Math.log10(1 + Math.max(0, repo.stargazers_count)) / 2;
  const forks = Math.log10(1 + Math.max(0, repo.forks_count)) / 2;
  return clamp(stars * 0.7 + forks * 0.3, 0, 1);
}

// 학습/연습 repo 로 추정되는 이름·description 패턴.
// 단어 경계로만 매칭해 의도치 않은 prefix 매칭(예: "studio" → "study")을 피한다.
const TUTORIAL_PATTERNS = [
  /\btutorials?\b/i,
  /\bpractice\b/i,
  /\bstudy\b/i,
  /\bstudies\b/i,
  /\bboilerplate\b/i,
  /\btemplate\b/i,
  /\btodo[-_]?app\b/i,
  /\bsample\b/i,
  /\bsamples\b/i,
  /\bhello[-_]?world\b/i,
  /\blearn(ing)?\b/i,
  /\bexercises?\b/i,
  /\bplayground\b/i,
  /\bsandbox\b/i,
  /\bclone\b/i, // "instagram-clone" 등 카피캣 학습 repo
];

function looksLikeTutorial(repo: GitHubRepo): boolean {
  const name = repo.name ?? "";
  const description = repo.description ?? "";
  return TUTORIAL_PATTERNS.some((rx) => rx.test(name) || rx.test(description));
}

// 사실상 빈 repo (size 가 매우 작음) 감점.
// GitHub repo size 단위는 KB. README + 설정 몇 개 있는 정상 프로젝트는 보통 100KB+ 이다.
function computeSizePenalty(repo: GitHubRepo): number {
  const size = typeof repo.size === "number" ? repo.size : -1;
  if (size < 0) return 0; // 정보 없음 → 패널티 X
  if (size < 10) return -20; // 거의 빈 repo
  if (size < 100) return -10; // 스캐폴드 수준
  return 0;
}

// shallow 단계 기본 점수 (README/구조 0으로 둠)
export function computeShallowScore(repo: GitHubRepo): { score: number; breakdown: ScoreBreakdown } {
  const { legacyBreakdown } = computeRepoScore(repo);

  const recencyWeighted = Math.round(recencyFactor(repo.updated_at) * 25);
  const hasDescription = !!repo.description && repo.description.trim().length > 0;
  const descriptionWeighted = hasDescription ? 15 : 0;
  const activityWeighted = Math.round(activityFactor(repo) * 15);

  // fork 차등화:
  // - fork 면서 description 도 비어 있으면 단순 복제로 가정 → -10
  // - fork 지만 description 이 적혀 있으면 의도적 활용/기여 가능성 → -5
  const forkPenalty = repo.fork ? (hasDescription ? -5 : -10) : 0;

  // topics 보너스: 관리 의지 / 분류 신호
  const topicsBonus =
    Array.isArray(repo.topics) && repo.topics.length > 0 ? 5 : 0;

  // 튜토리얼/학습용 repo 감점 (이름·설명 패턴)
  const tutorialPenalty = looksLikeTutorial(repo) ? -15 : 0;

  // 빈 repo 감점
  const sizePenalty = computeSizePenalty(repo);

  const breakdown: ScoreBreakdown = {
    ...legacyBreakdown,
    recencyWeighted,
    descriptionWeighted,
    readmeWeighted: 0,
    activityWeighted,
    structureWeighted: 0,
    forkPenalty,
    topicsBonus,
    tutorialPenalty,
    sizePenalty,
  };

  const score =
    recencyWeighted +
    descriptionWeighted +
    activityWeighted +
    forkPenalty +
    topicsBonus +
    tutorialPenalty +
    sizePenalty;

  return { score: clamp(score, 0, 100), breakdown };
}

// deep 수집 후 README/구조 점수를 채워 최종 점수를 다시 계산한다.
export function refineScoreWithDeepData(
  base: ScoredRepo,
  opts: { hasReadme: boolean; rootEntryCount: number },
): ScoredRepo {
  const readmeWeighted = opts.hasReadme ? 15 : 0;
  // 구조 점수: 루트에 3개 이상의 엔트리가 있어야 "비어 있지 않다"고 본다.
  const hasStructure = opts.rootEntryCount >= 3;
  const structureWeighted = hasStructure ? 20 : opts.rootEntryCount > 0 ? 10 : 0;

  const breakdown: ScoreBreakdown = {
    ...base.scoreBreakdown,
    readmeWeighted,
    structureWeighted,
  };

  const score = clamp(
    breakdown.recencyWeighted +
      breakdown.descriptionWeighted +
      breakdown.readmeWeighted +
      breakdown.activityWeighted +
      breakdown.structureWeighted +
      breakdown.forkPenalty +
      breakdown.topicsBonus +
      breakdown.tutorialPenalty +
      breakdown.sizePenalty,
    0,
    100,
  );

  return {
    ...base,
    score,
    scoreBreakdown: breakdown,
    hasReadme: opts.hasReadme,
    hasStructure,
  };
}

// === PoC 호환: 기존 시그니처 유지 (page.tsx 등에서 직접 호출되던 형태) ===
export function rankRepresentativeRepos(repos: GitHubRepo[], limit = 3): ScoredRepo[] {
  return repos
    .map((repo) => {
      const { score, breakdown } = computeShallowScore(repo);
      const { legacyScore } = computeRepoScore(repo);
      return {
        ...repo,
        score,
        legacyScore,
        scoreBreakdown: breakdown,
        hasReadme: false,
        hasStructure: false,
      } satisfies ScoredRepo;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getTopLanguage(repos: GitHubRepo[]): string {
  const counts = repos.reduce<Record<string, number>>((acc, repo) => {
    if (!repo.language) return acc;
    acc[repo.language] = (acc[repo.language] ?? 0) + 1;
    return acc;
  }, {});

  const [top] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return top?.[0] ?? "Unknown";
}

export function getLanguageDistribution(repos: GitHubRepo[]): Array<{ language: string; count: number }> {
  const counts = repos.reduce<Record<string, number>>((acc, repo) => {
    if (!repo.language) return acc;
    acc[repo.language] = (acc[repo.language] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count);
}
