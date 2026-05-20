// GitHub REST API 클라이언트
// - PoC 단계 라우트(app/api/analyze/route.ts)에서 인라인으로 작성됐던 fetch 로직을
//   분리해 재사용 가능한 형태로 정리한다. (수집/분석/렌더링 책임 분리 원칙)
// - 1차 shallow collection: 모든 공개 repo
// - 2차 deep collection: 대표 repo 3~5개에 대해서만 호출

import type { GitHubRepo } from "./scoring";
import type { DeepRepoData, RepoCommit, TreeEntry } from "./types";

export class GitHubApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly publicMessage: string,
    public readonly logMessage: string,
  ) {
    super(logMessage);
  }
}

const BASE_HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

const GITHUB_REPOS_PER_PAGE = 100;

function buildHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return token
    ? { ...BASE_HEADERS, Authorization: `Bearer ${token}` }
    : BASE_HEADERS;
}

async function fetchGitHub<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: buildHeaders(),
      next: { revalidate: 0 },
    });
  } catch (error) {
    throw new GitHubApiError(
      503,
      "GitHub API에 접속하지 못했습니다. 네트워크 상태를 확인해주세요.",
      `GitHub fetch threw: ${url} / ${String(error)}`,
    );
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new GitHubApiError(404, "GitHub 사용자를 찾을 수 없습니다.", `GitHub 404: ${url}`);
    }
    if (response.status === 403) {
      throw new GitHubApiError(
        429,
        "GitHub API 호출 한도에 도달했습니다. 잠시 후 다시 시도하세요.",
        `GitHub 403 rate limit: ${url}`,
      );
    }
    if (response.status === 401) {
      throw new GitHubApiError(
        401,
        "GitHub API 인증에 실패했습니다. GITHUB_TOKEN 값을 확인하세요.",
        `GitHub 401: ${url}`,
      );
    }
    throw new GitHubApiError(
      502,
      "GitHub 데이터를 가져오지 못했습니다.",
      `GitHub status ${response.status}: ${url}`,
    );
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new GitHubApiError(
      502,
      "GitHub 응답을 해석하지 못했습니다.",
      `GitHub JSON parse failed: ${url} / ${String(error)}`,
    );
  }
}

// 404/실패 시 null 을 반환하는 헬퍼 (README, tree 등은 없을 수 있다)
async function fetchGitHubOptional<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: buildHeaders(),
      next: { revalidate: 0 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchTextOptional(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: buildHeaders(),
      next: { revalidate: 0 },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export type UserProfile = {
  login: string;
  html_url: string;
  public_repos: number;
  name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
};

export async function fetchUserProfile(username: string): Promise<UserProfile> {
  return fetchGitHub<UserProfile>(`https://api.github.com/users/${username}`);
}

// 1차 shallow: 모든 공개 repo 메타데이터만 수집
// - 첫 페이지에서 실패하면 그대로 throw (사용자 자체 조회 실패와 유사 취급).
// - 두 번째 페이지 이후 실패는 부분 수집으로 처리해 분석을 이어간다.
export async function fetchAllUserRepos(
  username: string,
  onPartialFailure?: (message: string) => void,
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  // 안전 상한: 매우 활동적인 사용자(>1000 repo)의 경우 첫 10페이지 = 1000개로 제한
  const MAX_PAGES = 10;

  while (page <= MAX_PAGES) {
    let batch: GitHubRepo[];
    try {
      batch = await fetchGitHub<GitHubRepo[]>(
        `https://api.github.com/users/${username}/repos?sort=updated&per_page=${GITHUB_REPOS_PER_PAGE}&page=${page}`,
      );
    } catch (error) {
      if (page === 1) throw error;
      onPartialFailure?.(
        `GitHub API 제한 또는 오류로 ${page - 1}페이지(약 ${repos.length}개)까지만 수집했습니다.`,
      );
      break;
    }

    repos.push(...batch);
    if (batch.length < GITHUB_REPOS_PER_PAGE) break;
    page += 1;
  }

  return repos;
}

// PoC 호환: hasReadme 단독 호출용
export async function hasReadme(owner: string, repo: string): Promise<boolean> {
  const result = await fetchGitHubOptional<{ name: string }>(
    `https://api.github.com/repos/${owner}/${repo}/readme`,
  );
  return result !== null;
}

// 2차 deep collection: 대표 repo에 대해 다음을 병렬 조회
//   - README 원문 (raw)
//   - 루트 트리 (default branch)
//   - 언어 분포
//   - 최근 commit 10개
//   - 핵심 설정 파일 (package.json / requirements.txt / pyproject.toml /
//     pubspec.yaml / Dockerfile / build.gradle / pom.xml / .github/workflows 목록)
const CONFIG_FILES = [
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "pubspec.yaml",
  "Dockerfile",
  "build.gradle",
  "pom.xml",
] as const;

export async function fetchDeepRepoData(
  owner: string,
  repo: string,
  defaultBranch: string,
): Promise<DeepRepoData> {
  const branch = defaultBranch || "main";

  const [readmeText, rootTree, languages, commits, configFiles] = await Promise.all([
    fetchReadmeText(owner, repo),
    fetchRootTree(owner, repo, branch),
    fetchLanguages(owner, repo),
    fetchRecentCommits(owner, repo, 10),
    fetchConfigFiles(owner, repo, branch),
  ]);

  return { readmeText, rootTree, languages, commits, configFiles };
}

const README_MAX_LENGTH = 20_000;

async function fetchReadmeText(owner: string, repo: string): Promise<string | null> {
  // GitHub API는 readme 엔드포인트에서 base64 인코딩된 content를 돌려준다.
  // 디코딩 단계를 줄이려고 raw URL을 우선 호출하고, 실패 시 content 필드를 디코딩한다.
  const data = await fetchGitHubOptional<{ download_url: string | null; content?: string; encoding?: string }>(
    `https://api.github.com/repos/${owner}/${repo}/readme`,
  );

  if (!data) return null;

  if (data.download_url) {
    const text = await fetchTextOptional(data.download_url);
    if (text) return text.slice(0, README_MAX_LENGTH);
  }

  if (data.content && data.encoding === "base64") {
    try {
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      return decoded.slice(0, README_MAX_LENGTH);
    } catch {
      return null;
    }
  }

  return null;
}

async function fetchRootTree(
  owner: string,
  repo: string,
  branch: string,
): Promise<TreeEntry[]> {
  const data = await fetchGitHubOptional<{ tree: Array<{ path: string; type: string }> }>(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}`,
  );
  if (!data?.tree) return [];
  return data.tree.map((entry) => ({
    path: entry.path,
    type: entry.type === "blob" || entry.type === "tree" ? entry.type : entry.type,
  }));
}

async function fetchLanguages(owner: string, repo: string): Promise<Record<string, number>> {
  const data = await fetchGitHubOptional<Record<string, number>>(
    `https://api.github.com/repos/${owner}/${repo}/languages`,
  );
  return data ?? {};
}

async function fetchRecentCommits(
  owner: string,
  repo: string,
  perPage: number,
): Promise<RepoCommit[]> {
  type CommitItem = {
    sha: string;
    commit: {
      message: string;
      author?: { date?: string } | null;
      committer?: { date?: string } | null;
    };
  };
  const data = await fetchGitHubOptional<CommitItem[]>(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=${perPage}`,
  );
  if (!data) return [];
  return data.map((item) => ({
    sha: item.sha,
    message: (item.commit?.message ?? "").split("\n")[0]?.slice(0, 200) ?? "",
    authorDate: item.commit?.author?.date || item.commit?.committer?.date || new Date(0).toISOString(),
  }));
}

async function fetchConfigFiles(
  owner: string,
  repo: string,
  branch: string,
): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    CONFIG_FILES.map(async (file) => {
      const text = await fetchTextOptional(
        `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file}`,
      );
      return [file, text] as const;
    }),
  );

  return Object.fromEntries(entries);
}
