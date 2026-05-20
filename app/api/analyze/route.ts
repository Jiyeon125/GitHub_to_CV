import { NextRequest, NextResponse } from "next/server";
import { getTopLanguage, rankRepresentativeRepos, type GitHubRepo } from "@/lib/scoring";

type AnalyzeResponse = {
  username: string;
  profileUrl: string;
  publicRepos: number;
  selectedRepos: Array<ReturnType<typeof rankRepresentativeRepos>[number]>;
  topLanguage: string;
  summary: string;
};

const BASE_HEADERS: HeadersInit = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

const GITHUB_USERNAME_REGEX = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
// 메모리 기반 제한: 만료된 키를 정리해 Map이 무한히 커지는 것을 방지합니다.
// 다중 인스턴스/서버리스 프로덕션에서는 공유 저장소(Redis, Upstash 등)를 사용하세요.
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly publicMessage: string,
    public readonly logMessage: string,
  ) {
    super(logMessage);
  }
}

function buildHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return BASE_HEADERS;
  }

  return {
    ...BASE_HEADERS,
    Authorization: `Bearer ${token}`,
  };
}

async function fetchGitHub<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: buildHeaders(),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new ApiError(404, "GitHub user not found.", `GitHub 404 for URL: ${url}`);
    }

    if (response.status === 403) {
      throw new ApiError(
        429,
        "External API rate limit reached. Try again shortly.",
        `GitHub 403 rate limit for URL: ${url}`,
      );
    }

    throw new ApiError(
      502,
      "Failed to fetch data from GitHub.",
      `GitHub API failed with status ${response.status} for URL: ${url}`,
    );
  }

  return response.json();
}

const GITHUB_REPOS_PER_PAGE = 100;

async function fetchAllUserRepos(username: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;

  while (true) {
    const batch = await fetchGitHub<GitHubRepo[]>(
      `https://api.github.com/users/${username}/repos?sort=updated&per_page=${GITHUB_REPOS_PER_PAGE}&page=${page}`,
    );

    repos.push(...batch);

    if (batch.length < GITHUB_REPOS_PER_PAGE) {
      break;
    }

    page += 1;
  }

  return repos;
}

async function hasReadme(owner: string, repo: string): Promise<boolean> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: buildHeaders(),
    next: { revalidate: 0 },
  });

  return response.ok;
}

function isValidGitHubUsername(username: string) {
  return GITHUB_USERNAME_REGEX.test(username);
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function pruneExpiredRateLimitEntries(now: number) {
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}

function enforceRateLimit(clientIp: string) {
  const now = Date.now();
  pruneExpiredRateLimitEntries(now);

  const current = rateLimitStore.get(clientIp);

  if (!current || now > current.resetAt) {
    rateLimitStore.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new ApiError(
      429,
      "Too many requests. Please try again in a minute.",
      `Rate limit exceeded for IP: ${clientIp}`,
    );
  }

  current.count += 1;
  rateLimitStore.set(clientIp, current);
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    enforceRateLimit(clientIp);

    const body = await request.json();
    const username = String(body?.username ?? "").trim();

    if (!username) {
      throw new ApiError(400, "Username is required.", "Missing username in request body");
    }

    if (!isValidGitHubUsername(username)) {
      throw new ApiError(
        400,
        "Invalid GitHub username format.",
        `Invalid GitHub username received: ${username}`,
      );
    }

    const user = await fetchGitHub<{ public_repos: number; html_url: string }>(
      `https://api.github.com/users/${username}`,
    );

    const repos = await fetchAllUserRepos(username);

    if (!repos.length) {
      const emptyPayload: AnalyzeResponse = {
        username,
        profileUrl: user.html_url,
        publicRepos: user.public_repos,
        selectedRepos: [],
        topLanguage: "Unknown",
        summary: `${username} has no public repositories available for this PoC.`,
      };

      return NextResponse.json(emptyPayload);
    }

    const ranked = rankRepresentativeRepos(repos);
    const withReadme = await Promise.all(
      ranked.map(async (repo) => ({
        ...repo,
        hasReadme: await hasReadme(username, repo.name),
      })),
    );

    const topLanguage = getTopLanguage(repos);
    const summary = `${username} has ${user.public_repos} public repos. Top language: ${topLanguage}. Showing 3 representative repos using explicit rule-based scoring.`;

    const payload: AnalyzeResponse = {
      username,
      profileUrl: user.html_url,
      publicRepos: user.public_repos,
      selectedRepos: withReadme,
      topLanguage,
      summary,
    };

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`[analyze] ${error.logMessage}`);
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }

    console.error("[analyze] Unexpected server error", error);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
