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
};

export type ScoredRepo = GitHubRepo & {
  score: number;
  scoreBreakdown: {
    nonFork: number;
    description: number;
    language: number;
    stars: number;
    forks: number;
    recency: number;
  };
  hasReadme: boolean;
};

const DAY = 1000 * 60 * 60 * 24;

export function computeRepoScore(repo: GitHubRepo): Omit<ScoredRepo, keyof GitHubRepo | "hasReadme"> {
  const nonFork = repo.fork ? 0 : 20;
  const description = repo.description ? 10 : 0;
  const language = repo.language ? 10 : 0;
  const stars = Math.min(25, repo.stargazers_count);
  const forks = Math.min(15, repo.forks_count);

  const ageInDays = Math.max(0, (Date.now() - new Date(repo.updated_at).getTime()) / DAY);
  const recency = Math.max(0, 20 - Math.floor(ageInDays / 30));

  const scoreBreakdown = {
    nonFork,
    description,
    language,
    stars,
    forks,
    recency,
  };

  return {
    score: Object.values(scoreBreakdown).reduce((sum, value) => sum + value, 0),
    scoreBreakdown,
  };
}

export function rankRepresentativeRepos(repos: GitHubRepo[]) {
  return repos
    .map((repo) => ({ ...repo, ...computeRepoScore(repo) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function getTopLanguage(repos: GitHubRepo[]) {
  const counts = repos.reduce<Record<string, number>>((acc, repo) => {
    if (!repo.language) return acc;
    acc[repo.language] = (acc[repo.language] ?? 0) + 1;
    return acc;
  }, {});

  const [top] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return top?.[0] ?? "Unknown";
}
