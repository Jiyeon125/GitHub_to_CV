// 단순 in-memory TTL 캐시
// - 분석 결과 페이로드 / GitHub 응답 / LLM 응답 등을 키로 식별해 일정 시간 동안 재사용한다.
// - 다중 서버리스 인스턴스 환경에서는 한계가 있지만 MVP 캐시 요구사항을 충족한다.
// - 캐시 키에는 username, 옵션, repo updated_at 등 변경 감지에 필요한 값을 포함시킬 것.

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10분

function prune(now: number) {
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) store.delete(key);
  }
}

export function getCached<T>(key: string): T | null {
  const now = Date.now();
  prune(now);
  const entry = store.get(key);
  if (!entry) return null;
  if (now > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function buildAnalyzeCacheKey(opts: {
  username: string;
  representativeCount: number;
  useLlm: boolean;
  mode: "self" | "public";
  includePrivate: boolean;
}): string {
  // updated_at 은 분석 시점 GitHub 응답에 따라 달라지므로 키에 포함시키지 않는다.
  // - mode/private 은 응답 내용을 바꾸므로 캐시 키에 포함한다.
  // - private 포함 결과를 비로그인 또는 게스트가 받아가지 못하도록 라우트에서 한 번 더 인증을 검사한다.
  return [
    "analyze",
    opts.username.toLowerCase(),
    `n=${opts.representativeCount}`,
    `llm=${opts.useLlm ? 1 : 0}`,
    `mode=${opts.mode}`,
    `priv=${opts.includePrivate ? 1 : 0}`,
  ].join(":");
}
