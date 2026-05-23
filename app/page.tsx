"use client";

import { useCallback, useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import { useSession } from "next-auth/react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import LoadingProgress from "./components/LoadingProgress";
import type { AnalyzeResponse } from "@/lib/types";

const EXAMPLE_USERNAMES = ["torvalds", "gaearon", "yyx990803"];

// 에러 메시지 내용에 따라 사용자에게 더 적합한 후속 안내를 노출한다.
function getErrorHint(message: string): string {
  if (/찾을 수 없습니다|404/i.test(message)) {
    return "username 철자를 다시 확인하십시오.";
  }
  if (/호출 한도|rate limit|429/i.test(message)) {
    return "잠시 후 다시 시도하거나, GitHub 로그인으로 호출 한도를 확장하십시오.";
  }
  if (/요청 한도/.test(message)) {
    return "잠시 후 다시 시도하십시오.";
  }
  if (/username|입력|형식/.test(message)) {
    return "GitHub username 입력값을 다시 확인하십시오.";
  }
  if (/네트워크|접속/.test(message)) {
    return "네트워크 연결 상태를 확인한 뒤 다시 시도하십시오.";
  }
  if (/인증/.test(message)) {
    return "로그인 상태를 확인한 뒤 다시 시도하십시오.";
  }
  return "잠시 후 다시 시도하거나 입력값을 확인하십시오.";
}

export default function Home() {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated" && Boolean(session?.user?.login);
  const sessionLogin = session?.user?.login ?? "";

  const [username, setUsername] = useState("");
  const [representativeCount, setRepresentativeCount] = useState(3);
  const [useLlm, setUseLlm] = useState(false);
  const [mode, setMode] = useState<"self" | "public">("public");
  const [includePrivate, setIncludePrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  useEffect(() => {
    if (!isAuthed) {
      setMode("public");
      setIncludePrivate(false);
      return;
    }
    setMode((prev) => (prev === "public" ? "self" : prev));
  }, [isAuthed]);

  const effectiveMode: "self" | "public" = isAuthed ? mode : "public";

  const runAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: effectiveMode === "self" ? sessionLogin : username,
          representativeCount,
          useLlm,
          mode: effectiveMode,
          includePrivate: effectiveMode === "self" ? includePrivate : false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "분석 요청에 실패했습니다.");
      }

      setResult(data as AnalyzeResponse);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "알 수 없는 오류가 발생했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [username, representativeCount, useLlm, effectiveMode, includePrivate, sessionLogin]);

  function handlePrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  return (
    <div className="app-shell flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar
        username={username}
        onUsernameChange={setUsername}
        representativeCount={representativeCount}
        onRepresentativeCountChange={setRepresentativeCount}
        useLlm={useLlm}
        onUseLlmChange={setUseLlm}
        mode={effectiveMode}
        onModeChange={setMode}
        includePrivate={includePrivate}
        onIncludePrivateChange={setIncludePrivate}
        loading={loading}
        onSubmit={runAnalyze}
      />

      <main className="app-main flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b border-border bg-background shrink-0 no-print">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">예시:</span>
            {EXAMPLE_USERNAMES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setUsername(example)}
                disabled={loading || (isAuthed && effectiveMode === "self")}
                className="px-2.5 py-1 text-xs font-mono border border-border rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {example}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!result || loading}
            className="flex items-center gap-2 px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileDown className="w-3.5 h-3.5" />
            PDF로 저장 / 인쇄
          </button>
        </div>

        {/* Main Content */}
        <div className="app-scroll flex-1 overflow-y-auto">
          {loading && <LoadingProgress useLlm={useLlm} />}

          {error && !loading && (
            <div className="flex items-center justify-center min-h-[400px] p-6">
              <div className="text-center max-w-sm">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl text-destructive">✕</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-foreground">오류</h3>
                <p className="text-sm text-muted-foreground mb-2">{error}</p>
                <p className="text-xs text-muted-foreground">
                  {getErrorHint(error)}
                </p>
              </div>
            </div>
          )}

          {!loading && !error && !result && (
            <div className="flex items-center justify-center min-h-[calc(100vh-100px)] p-6">
              <div className="max-w-lg w-full">
                <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto mb-8">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-border fill-current" aria-hidden>
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                  </svg>
                </div>

                <h2 className="text-xl font-bold text-foreground text-center mb-3">
                  {isAuthed
                    ? `@${sessionLogin} 계정 기준으로 분석을 시작하십시오`
                    : "GitHub username을 입력한 뒤 분석을 시작하십시오"}
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-8">
                  {isAuthed
                    ? "사이드바에서 private 포함 여부와 옵션을 선택한 뒤 [분석 시작] 버튼을 누르면 본인 저장소 기반 리포트를 생성합니다."
                    : "사이드바에 username을 입력한 뒤 [분석 시작] 버튼을 누르면 공개 저장소 기반 개발 활동 추정 리포트를 생성합니다."}
                </p>

                <ul className="space-y-3">
                  {[
                    { color: "#7C6AF7", text: "전체 저장소 대상 6축 분야 점수 레이더 차트" },
                    { color: "#22D3A0", text: "기술 스택 자동 추출 + 언어 분포 바 차트" },
                    { color: "#F59E0B", text: "LLM 기반 포트폴리오 문장 · 이력서 bullet · 면접 질문" },
                    { color: "#3178C6", text: "PDF · 인쇄형 보고서 한 번에 출력" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      {item.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {result && !loading && <Dashboard data={result} />}
        </div>
      </main>
    </div>
  );
}
