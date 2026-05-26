// 분석 라우트
// - PoC의 입력 검증, IP rate limit, 에러 응답 포맷은 그대로 유지한다.
// - 실제 분석 파이프라인은 lib/analyze.ts 의 runAnalyze 에 위임한다.
// - 동일 입력에 대한 캐시도 여기서 적용해 GitHub API 호출 비용을 줄인다.

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

import { runAnalyze } from "@/lib/analyze";
import { GitHubApiError } from "@/lib/github";
import { buildAnalyzeCacheKey, getCached, setCached } from "@/lib/cache";
import type { AnalyzeResponse, LlmConfig } from "@/lib/types";

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

// 사용자가 보낸 LLM 설정을 안전하게 파싱한다.
// - 알 수 없는 choice 는 기본값으로 떨어뜨린다.
// - apiKey / baseUrl / model 은 문자열 길이/타입만 가볍게 검사. (실제 검증은 호출 시 게이트웨이가 거절)
// - 응답/로그/캐시 키에는 절대 raw apiKey 를 노출하지 않는다.
const ALLOWED_LLM_CHOICES = new Set<LlmConfig["choice"]>([
  "gateway-gpt",
  "gateway-claude",
  "gateway-gemini",
  "custom",
]);

function parseLlmConfig(input: unknown): LlmConfig | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const choiceRaw = obj.choice;
  const choice =
    typeof choiceRaw === "string" && ALLOWED_LLM_CHOICES.has(choiceRaw as LlmConfig["choice"])
      ? (choiceRaw as LlmConfig["choice"])
      : "gateway-gpt";

  if (choice !== "custom") {
    return { choice };
  }

  const apiKey = typeof obj.apiKey === "string" ? obj.apiKey.trim().slice(0, 512) : "";
  const baseUrl = typeof obj.baseUrl === "string" ? obj.baseUrl.trim().slice(0, 512) : "";
  const model = typeof obj.model === "string" ? obj.model.trim().slice(0, 128) : "";

  return {
    choice: "custom",
    apiKey: apiKey || null,
    baseUrl: baseUrl || null,
    model: model || null,
  };
}

// 캐시 키에 LLM 설정을 반영한다.
// - 같은 게이트웨이 모델끼리는 캐시 공유. (서버 키 1개 = 안전 공유 가능)
// - custom 키는 사용자별로 다르므로, apiKey 의 해시 prefix 만 사용해 사용자/캐시 격리.
async function llmCacheTag(config: LlmConfig | null): Promise<string> {
  if (!config) return "llm=default";
  if (config.choice !== "custom") {
    return `llm=${config.choice}`;
  }
  const fingerprint = await fingerprintApiKey(config.apiKey ?? "");
  return `llm=custom:${(config.model ?? "").slice(0, 24)}:${fingerprint}`;
}

async function fingerprintApiKey(apiKey: string): Promise<string> {
  if (!apiKey) return "anon";
  // 캐시 격리 목적이라 충돌 위험만 낮으면 충분. SHA-256 의 앞 16자만 사용.
  const data = new TextEncoder().encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
      "요청 한도를 초과했습니다. 잠시 후 다시 시도하십시오.",
      `Rate limit exceeded for IP: ${clientIp}`,
    );
  }

  current.count += 1;
  rateLimitStore.set(clientIp, current);
}

async function readSessionFromRequest(request: NextRequest) {
  if (!process.env.NEXTAUTH_SECRET) {
    console.warn("[analyze] NEXTAUTH_SECRET is not configured; continuing without session.");
    return { sessionLogin: null, sessionAccessToken: null };
  }

  try {
    const jwt = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });

    return {
      sessionLogin:
        typeof jwt?.login === "string" && jwt.login.length > 0 ? jwt.login : null,
      sessionAccessToken:
        typeof jwt?.accessToken === "string" && jwt.accessToken.length > 0
          ? jwt.accessToken
          : null,
    };
  } catch (error) {
    console.error("[analyze] Failed to read NextAuth token; continuing as public mode.", error);
    return { sessionLogin: null, sessionAccessToken: null };
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    enforceRateLimit(clientIp);

    const body = await request.json().catch(() => null);
    const rawUsername = String(body?.username ?? "").trim();
    const useLlm = Boolean(body?.useLlm);
    const representativeCount = Number(body?.representativeCount ?? 3);
    const includePrivateRequested = Boolean(body?.includePrivate);
    const llmConfig = useLlm ? parseLlmConfig(body?.llmConfig) : null;

    // NextAuth JWT 에서 access_token / login 추출.
    // 세션 유무를 먼저 확인해야 "로그인 상태에서 남의 계정 분석" 같은 케이스를 막을 수 있다.
    // 세션 읽기에 실패해도(예: NEXTAUTH_SECRET 미설정) 미로그인 게스트 분석은 계속 가능하다.
    const { sessionLogin, sessionAccessToken } = await readSessionFromRequest(request);
    const isAuthed = Boolean(sessionAccessToken && sessionLogin);

    // === 모드 결정 ===
    // - 로그인 상태: 항상 self (본인 계정 전용). 클라이언트가 보낸 username 은 무시한다.
    //   다른 사용자 분석은 정책상 차단 (로그아웃 후 게스트 모드 사용).
    // - 미로그인 상태: 항상 public + username 필수.
    let mode: "self" | "public";
    let username = rawUsername;
    let includePrivate = false;

    if (isAuthed) {
      mode = "self";
      username = sessionLogin!;
      includePrivate = includePrivateRequested;
    } else {
      mode = "public";
      if (!username) {
        throw new ApiError(400, "GitHub username을 입력하십시오.", "Missing username");
      }
      if (!isValidGitHubUsername(username)) {
        throw new ApiError(
          400,
          "GitHub username 형식이 올바르지 않습니다.",
          `Invalid username: ${username}`,
        );
      }
    }

    // 대표 repo 개수 상한 안전망:
    // - 미인증(public 모드): GitHub API 60회/시간 한도 보호. 최대 3 개로 강제.
    // - 인증(self 모드): 최대 5.
    // 클라이언트 UI 가 이미 같은 max 를 적용하지만, 직접 POST 호출로 우회되는 경우를 막는다.
    const representativeCountMax = mode === "self" ? 5 : 3;
    const clampedRepresentativeCount = Math.max(
      1,
      Math.min(representativeCountMax, Number.isFinite(representativeCount) ? representativeCount : 3),
    );

    // 캐시 확인 (TTL 10분). 동일 입력에 한해 GitHub/LLM 비용을 절약한다.
    // - LLM 설정(provider/model)이 다르면 다른 캐시 슬롯을 쓰도록 tag 를 함께 사용.
    const llmTag = await llmCacheTag(llmConfig);
    const cacheKey = `${buildAnalyzeCacheKey({
      username,
      representativeCount: clampedRepresentativeCount,
      useLlm,
      mode,
      includePrivate,
    })}:${llmTag}`;
    const cached = getCached<AnalyzeResponse>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    const payload = await runAnalyze(
      { username, representativeCount: clampedRepresentativeCount, useLlm, llmConfig },
      {
        mode,
        includePrivate,
        userAccessToken: mode === "self" ? sessionAccessToken : null,
      },
    );
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
