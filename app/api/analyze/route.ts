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
      throw new Error("GitHub user not found.");
    }

    if (response.status === 403) {
      throw new Error(
        "GitHub rate limit exceeded. Add GITHUB_TOKEN for higher limits or try later.",
      );
    }

    throw new Error(`GitHub API request failed with status ${response.status}.`);
  }

  return response.json();
}

async function hasReadme(owner: string, repo: string): Promise<boolean> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
    headers: buildHeaders(),
    next: { revalidate: 0 },
  });

  return response.ok;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? "").trim();

    if (!username) {
      return NextResponse.json({ error: "Username is required." }, { status: 400 });
    }

    const user = await fetchGitHub<{ public_repos: number; html_url: string }>(
      `https://api.github.com/users/${username}`,
    );

    const repos = await fetchGitHub<GitHubRepo[]>(
      `https://api.github.com/users/${username}/repos?sort=updated&per_page=100`,
    );

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
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
