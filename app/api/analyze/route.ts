// 분석 라우트
// - PoC의 입력 검증, IP rate limit, 에러 응답 포맷은 그대로 유지한다.
// - 실제 분석 파이프라인은 lib/analyze.ts 의 runAnalyze 에 위임한다.
// - 동일 입력에 대한 캐시도 여기서 적용해 GitHub API 호출 비용을 줄인다.

import { NextRequest, NextResponse } from "next/server";

import { runAnalyze } from "@/lib/analyze";
import { GitHubApiError } from "@/lib/github";
import { buildAnalyzeCacheKey, getCached, setCached } from "@/lib/cache";
import type { AnalyzeResponse } from "@/lib/types";

const GITHUB_USERNAME_REGEX = /^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$/;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
// 메모리 기반 rate limit (PoC와 동일). 만료된 키는 주기적으로 정리한다.
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
    if (now > entry.resetAt) rateLimitStore.delete(key);
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
      "요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.",
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

    const body = await request.json().catch(() => null);
    const username = String(body?.username ?? "").trim();
    const useLlm = Boolean(body?.useLlm);
    const representativeCount = Number(body?.representativeCount ?? 3);

    if (!username) {
      throw new ApiError(400, "GitHub username을 입력해주세요.", "Missing username");
    }
    if (!isValidGitHubUsername(username)) {
      throw new ApiError(400, "GitHub username 형식이 올바르지 않습니다.", `Invalid username: ${username}`);
    }

    // 캐시 확인 (TTL 10분). 동일 입력에 한해 GitHub/LLM 비용을 절약한다.
    const cacheKey = buildAnalyzeCacheKey({ username, representativeCount, useLlm });
    const cached = getCached<AnalyzeResponse>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    const payload = await runAnalyze({ username, representativeCount, useLlm });
    setCached(cacheKey, payload);

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`[analyze] ${error.logMessage}`);
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }
    if (error instanceof GitHubApiError) {
      console.error(`[analyze] ${error.logMessage}`);
      return NextResponse.json({ error: error.publicMessage }, { status: error.status });
    }
    console.error("[analyze] Unexpected server error", error);
    return NextResponse.json({ error: "예상치 못한 서버 오류가 발생했습니다." }, { status: 500 });
  }
}
