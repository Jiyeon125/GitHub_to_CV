// GitHub REST API 클라이언트
// - PoC 단계 라우트(app/api/analyze/route.ts)에서 인라인으로 작성됐던 fetch 로직을
//   분리해 재사용 가능한 형태로 정리한다. (수집/분석/렌더링 책임 분리 원칙)
// - 1차 shallow collection: 모든 공개 repo
// - 2차 deep collection: 대표 repo 1~5개에 대해서만 호출

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

// GitHub API 호출 시 사용할 토큰 컨텍스트.
// - userAccessToken: NextAuth 로 받은 본인의 OAuth access token (있으면 우선)
// - 없으면 서비스 공용 GITHUB_TOKEN(.env) 사용
// - 둘 다 없으면 미인증 호출(시간당 60회 제한)
export type GitHubAuth = {
  userAccessToken?: string | null;
};

// 서버측 GITHUB_TOKEN 이 401 을 한 번 받으면, 이 프로세스 동안은 재시도하지 않고 미인증으로 사용한다.
// (만료된 PAT 가 .env 에 남아 있어도 미로그인 게스트 분석이 깨지지 않도록 한다.)
let serverTokenDisabled = false;

function pickServerToken(): string | null {
  if (serverTokenDisabled) return null;
  return process.env.GITHUB_TOKEN || null;
}

function buildHeaders(auth?: GitHubAuth): HeadersInit {
  const token = auth?.userAccessToken || pickServerToken();
  return token
    ? { ...BASE_HEADERS, Authorization: `Bearer ${token}` }
    : BASE_HEADERS;
}

// 인증 호출 여부(=시간당 5000회 한도). user OAuth token 또는 서버 GITHUB_TOKEN 이 있으면 true.
// 미인증(60회/시간)에서는 추가 호출이 부담되므로, README peek 같은 보강 호출의 on/off 판단에 쓴다.
export function isAuthenticated(auth?: GitHubAuth): boolean {
  return !!(auth?.userAccessToken || pickServerToken());
}

// 401 응답이고, 이번 호출이 "서버 GITHUB_TOKEN" 으로 갔던 경우에만 true.
// 사용자 OAuth access token 의 401 은 진짜 인증 문제이므로 fallback 하지 않는다.
function shouldRetryWithoutServerToken(
  status: number,
  auth?: GitHubAuth,
): boolean {
  if (status !== 401) return false;
  if (auth?.userAccessToken) return false;
  return Boolean(process.env.GITHUB_TOKEN) && !serverTokenDisabled;
}

async function fetchGitHub<T>(url: string, auth?: GitHubAuth): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: buildHeaders(auth),
      next: { revalidate: 0 },
    });
  } catch (error) {
    throw new GitHubApiError(
      503,
      "GitHub API에 접속하지 못했습니다. 네트워크 상태를 확인하십시오.",
      `GitHub fetch threw: ${url} / ${String(error)}`,
    );
  }

  // 서버 GITHUB_TOKEN 이 만료된 경우 한 번 비우고 재시도.
  if (shouldRetryWithoutServerToken(response.status, auth)) {
    console.warn(
      "[github] Server GITHUB_TOKEN returned 401; disabling it for this process and retrying unauthenticated.",
    );
    serverTokenDisabled = true;
    try {
      response = await fetch(url, {
        headers: buildHeaders(auth),
        next: { revalidate: 0 },
      });
    } catch (error) {
      throw new GitHubApiError(
        503,
        "GitHub API에 접속하지 못했습니다. 네트워크 상태를 확인하십시오.",
        `GitHub fetch threw (retry): ${url} / ${String(error)}`,
      );
    }
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new GitHubApiError(404, "GitHub 사용자를 찾을 수 없습니다.", `GitHub 404: ${url}`);
    }
    if (response.status === 403) {
      throw new GitHubApiError(
        429,
        "GitHub API 호출 한도에 도달했습니다. 잠시 후 다시 시도하십시오.",
        `GitHub 403 rate limit: ${url}`,
      );
    }
    if (response.status === 401) {
      // 여기까지 왔다면 호출 측이 전달한 토큰(사용자 OAuth 또는 게스트 PAT) 자체가 만료/무효.
      throw new GitHubApiError(
        401,
        "GitHub 인증에 실패했습니다. 입력한 토큰을 확인하거나 다시 로그인해 주세요.",
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

// 404/실패 시 null 을 반환하는 헬퍼 (README, tree 등은 없을 수 있다).
// 만료된 서버 토큰으로 401 이 떨어진 경우엔 한 번 미인증으로 재시도해서, 게스트 분석에서도
// optional 데이터(README/tree/언어 분포 등)가 모두 누락되지 않도록 한다.
async function fetchOptionalRaw(
  url: string,
  auth?: GitHubAuth,
): Promise<Response | null> {
  try {
    let response = await fetch(url, {
      headers: buildHeaders(auth),
      next: { revalidate: 0 },
    });
    if (shouldRetryWithoutServerToken(response.status, auth)) {
      console.warn(
        "[github] Server GITHUB_TOKEN returned 401 (optional); retrying unauthenticated.",
      );
      serverTokenDisabled = true;
      response = await fetch(url, {
        headers: buildHeaders(auth),
        next: { revalidate: 0 },
      });
    }
    if (!response.ok) return null;
    return response;
  } catch {
    return null;
  }
}

async function fetchGitHubOptional<T>(url: string, auth?: GitHubAuth): Promise<T | null> {
  const response = await fetchOptionalRaw(url, auth);
  if (!response) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchTextOptional(url: string, auth?: GitHubAuth): Promise<string | null> {
  const response = await fetchOptionalRaw(url, auth);
  if (!response) return null;
  try {
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

export async function fetchUserProfile(
  username: string,
  auth?: GitHubAuth,
): Promise<UserProfile> {
  return fetchGitHub<UserProfile>(`https://api.github.com/users/${username}`, auth);
}

// 인증된 본인 자신의 프로필 (private repo 개수 등이 포함됨)
export type AuthedUserProfile = UserProfile & {
  total_private_repos?: number;
  owned_private_repos?: number;
};

export async function fetchAuthedUserProfile(auth: GitHubAuth): Promise<AuthedUserProfile> {
  return fetchGitHub<AuthedUserProfile>("https://api.github.com/user", auth);
}

// 1차 shallow: 사용자의 repo 메타데이터 수집.
// - mode "public" (기본): /users/{username}/repos 사용 (공개 repo 만 보임)
// - mode "self":         /user/repos 사용 (인증된 본인의 public + private 포함)
//                        token 의 visibility 파라미터로 범위 좁힐 수 있음.
// - 첫 페이지에서 실패하면 그대로 throw (사용자 자체 조회 실패와 유사 취급).
// - 두 번째 페이지 이후 실패는 부분 수집으로 처리해 분석을 이어간다.
export type RepoCollectionMode =
  | { kind: "public"; username: string }
  | { kind: "self"; visibility: "all" | "public" | "private" };

export async function fetchAllUserRepos(
  modeOrUsername: RepoCollectionMode | string,
  onPartialFailure?: (message: string) => void,
  auth?: GitHubAuth,
): Promise<GitHubRepo[]> {
  const mode: RepoCollectionMode =
    typeof modeOrUsername === "string"
      ? { kind: "public", username: modeOrUsername }
      : modeOrUsername;

  const repos: GitHubRepo[] = [];
  let page = 1;
  // 안전 상한: 매우 활동적인 사용자(>1000 repo)의 경우 첫 10페이지 = 1000개로 제한
  const MAX_PAGES = 10;

  while (page <= MAX_PAGES) {
    let batch: GitHubRepo[];
    const url =
      mode.kind === "self"
        ? `https://api.github.com/user/repos?sort=updated&per_page=${GITHUB_REPOS_PER_PAGE}&page=${page}&visibility=${mode.visibility}&affiliation=owner`
        : `https://api.github.com/users/${mode.username}/repos?sort=updated&per_page=${GITHUB_REPOS_PER_PAGE}&page=${page}`;
    try {
      batch = await fetchGitHub<GitHubRepo[]>(url, auth);
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
export async function hasReadme(owner: string, repo: string, auth?: GitHubAuth): Promise<boolean> {
  const result = await fetchGitHubOptional<{ name: string }>(
    `https://api.github.com/repos/${owner}/${repo}/readme`,
    auth,
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
  auth?: GitHubAuth,
): Promise<DeepRepoData> {
  const branch = defaultBranch || "main";

  // 호출량을 줄이기 위해 readme / rootTree / languages / commits 를 먼저 병렬로 받고,
  // configFiles 는 rootTree 결과 기준으로 "실제 루트에 존재하는 파일만" 호출한다.
  // (미인증 60회/시간 한도에서도 더 많은 repo 분석을 가능하게 한다.)
  const [readmeText, fullTree, languages, commits] = await Promise.all([
    fetchReadmeText(owner, repo, auth),
    fetchFullTree(owner, repo, branch, auth),
    fetchLanguages(owner, repo, auth),
    fetchRecentCommits(owner, repo, 10, auth),
  ]);

  // rootTree(최상위)는 기존 구조 점수/techStack 계산 의미를 유지하기 위해 재귀 트리에서 파생한다.
  // fileTree(정제한 재귀 경로)는 "핵심 자산"을 짚기 위해 LLM 입력으로 따로 사용한다.
  const rootTree = fullTree.filter((entry) => !entry.path.includes("/"));
  const fileTree = curateFileTree(fullTree);

  const [configFiles, envKeys] = await Promise.all([
    fetchConfigFiles(owner, repo, branch, rootTree, auth),
    fetchEnvExampleKeys(owner, repo, branch, fullTree, auth),
  ]);

  return { readmeText, rootTree, fileTree, envKeys, languages, commits, configFiles };
}

// 트리에서 제외할 노이즈(빌드 산출물 / 락파일 / 바이너리·미디어 등).
const TREE_NOISE_RE =
  /(^|\/)(node_modules|dist|build|out|\.next|\.nuxt|\.git|vendor|coverage|__pycache__|\.venv|venv|env|target|\.idea|\.vscode|\.cache|tmp)(\/|$)|\.(lock|min\.js|min\.css|map|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|eot|otf|mp4|mov|pdf|zip|gz)$|(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/i;

// 재귀 트리에서 "아키텍처를 드러내는" 소스 경로만 정제해 추린다.
// - 파일명/디렉토리명 자체가 핵심 신호이므로(예: lib/llm.ts) blob 경로를 그대로 노출한다.
// - 노이즈를 걷어내고 상한(80)을 둬 LLM 토큰 비용을 억제한다(LLM 입력에서 한 번 더 자름).
function curateFileTree(full: TreeEntry[]): string[] {
  return full
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter((path) => !TREE_NOISE_RE.test(path))
    .slice(0, 80);
}

// .env "예시" 파일만 식별한다. 실제 시크릿이 들어갈 수 있는 .env / .env.local 등은 제외한다.
function isEnvExamplePath(path: string): boolean {
  const name = (path.split("/").pop() ?? "").toLowerCase();
  if (!name.includes("env")) return false;
  // 실제 환경 파일(시크릿 가능) 제외
  if (/^\.env(\.(local|development|dev|production|prod|test|staging))?$/.test(name)) return false;
  // 예시/샘플/템플릿 형태만 허용
  return /(example|sample|template|dist|default)/.test(name);
}

// .env 예시 파일에서 "변수 이름만" 추출한다.
// - 값(placeholder 포함)은 전부 버려 프라이버시/결정성을 지킨다.
// - 변수명은 외부 연동/서비스 신호다(OPENAI_API_KEY, DATABASE_URL, NEXTAUTH_SECRET 등).
function parseEnvKeys(text: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.replace(/^export\s+/i, "");
    const eqIndex = withoutExport.indexOf("=");
    const key = (eqIndex >= 0 ? withoutExport.slice(0, eqIndex) : withoutExport).trim();
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !seen.has(key)) {
      seen.add(key);
      keys.push(key);
      if (keys.length >= 25) break;
    }
  }
  return keys;
}

async function fetchEnvExampleKeys(
  owner: string,
  repo: string,
  branch: string,
  fullTree: TreeEntry[],
  auth?: GitHubAuth,
): Promise<string[]> {
  const target = fullTree.find((entry) => entry.type === "blob" && isEnvExamplePath(entry.path));
  if (!target) return [];

  const data = await fetchGitHubOptional<{
    content?: string;
    encoding?: string;
    download_url?: string | null;
  }>(`https://api.github.com/repos/${owner}/${repo}/contents/${target.path}?ref=${branch}`, auth);

  let text: string | null = null;
  if (data?.content && data.encoding === "base64") {
    try {
      text = Buffer.from(data.content, "base64").toString("utf-8");
    } catch {
      text = null;
    }
  }
  if (!text && data?.download_url) {
    text = await fetchTextOptional(data.download_url);
  }
  if (!text) return [];
  return parseEnvKeys(text);
}

const README_MAX_LENGTH = 20_000;

async function fetchReadmeText(
  owner: string,
  repo: string,
  auth?: GitHubAuth,
  maxLength: number = README_MAX_LENGTH,
): Promise<string | null> {
  // GitHub API는 readme 엔드포인트에서 base64 인코딩된 content를 돌려준다.
  // - private repo 의 raw URL 은 인증이 필요하므로, private 가능성이 있을 땐
  //   download_url 보다 content (base64) 경로가 더 안전하다.
  const data = await fetchGitHubOptional<{
    download_url: string | null;
    content?: string;
    encoding?: string;
  }>(`https://api.github.com/repos/${owner}/${repo}/readme`, auth);

  if (!data) return null;

  // private repo 의 download_url 은 인증된 별도 토큰이 박힌 임시 URL 이므로
  // user access token 으로 그대로 fetch 하면 실패할 수 있다.
  // 따라서 base64 content 가 있으면 그것을 먼저 사용한다.
  if (data.content && data.encoding === "base64") {
    try {
      const decoded = Buffer.from(data.content, "base64").toString("utf-8");
      return decoded.slice(0, maxLength);
    } catch {
      // fall through
    }
  }

  if (data.download_url) {
    // public repo 의 raw URL 은 인증 없이도 동작한다.
    const text = await fetchTextOptional(data.download_url);
    if (text) return text.slice(0, maxLength);
  }

  return null;
}

// 대표 repo 선정 보강용: README 앞부분만 가볍게 받아온다(선정 정확도 ↑, 토큰 비용 ↓).
// deep 수집 전 후보 풀에 대해서만 호출하며, 인증 호출일 때만 켠다(호출량 부담 회피).
export async function fetchReadmeSnippet(
  owner: string,
  repo: string,
  auth?: GitHubAuth,
  maxChars: number = 500,
): Promise<string | null> {
  return fetchReadmeText(owner, repo, auth, maxChars);
}

// 재귀 트리: 중첩된 파일 경로까지 한 번의 호출(?recursive=1)로 가져온다.
// 대형 repo 에서 truncated 될 수 있으나, 받은 만큼만 사용한다(핵심 자산 식별엔 충분).
async function fetchFullTree(
  owner: string,
  repo: string,
  branch: string,
  auth?: GitHubAuth,
): Promise<TreeEntry[]> {
  const data = await fetchGitHubOptional<{
    tree: Array<{ path: string; type: string }>;
    truncated?: boolean;
  }>(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`, auth);
  if (!data?.tree) return [];
  return data.tree.map((entry) => ({
    path: entry.path,
    type: entry.type === "blob" || entry.type === "tree" ? entry.type : entry.type,
  }));
}

async function fetchLanguages(
  owner: string,
  repo: string,
  auth?: GitHubAuth,
): Promise<Record<string, number>> {
  const data = await fetchGitHubOptional<Record<string, number>>(
    `https://api.github.com/repos/${owner}/${repo}/languages`,
    auth,
  );
  return data ?? {};
}

async function fetchRecentCommits(
  owner: string,
  repo: string,
  perPage: number,
  auth?: GitHubAuth,
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
    auth,
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
  rootTree: TreeEntry[],
  auth?: GitHubAuth,
): Promise<Record<string, string | null>> {
  // rootTree 에 등장한 (= 루트에 실제로 존재하는) config 파일만 contents API 로 가져온다.
  // 모든 CONFIG_FILES 를 무조건 호출하던 기존 방식 대비 호출 수가 7 → 평균 1~3 으로 감소.
  // raw.githubusercontent.com 은 private repo 인증이 까다로워 contents API 로 통일.
  // 응답에 base64 content 가 들어오면 디코딩, 없으면 download_url 우회.
  const rootFileSet = new Set(
    rootTree.filter((entry) => entry.type === "blob").map((entry) => entry.path),
  );

  const entries = await Promise.all(
    CONFIG_FILES.map(async (file) => {
      if (!rootFileSet.has(file)) {
        return [file, null] as const;
      }

      const data = await fetchGitHubOptional<{
        content?: string;
        encoding?: string;
        download_url?: string | null;
      }>(`https://api.github.com/repos/${owner}/${repo}/contents/${file}?ref=${branch}`, auth);

      if (!data) return [file, null] as const;

      if (data.content && data.encoding === "base64") {
        try {
          const decoded = Buffer.from(data.content, "base64").toString("utf-8");
          return [file, decoded] as const;
        } catch {
          // fall through
        }
      }
      if (data.download_url) {
        const text = await fetchTextOptional(data.download_url);
        if (text) return [file, text] as const;
      }
      return [file, null] as const;
    }),
  );

  return Object.fromEntries(entries);
}
