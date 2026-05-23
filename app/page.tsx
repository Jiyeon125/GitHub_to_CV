"use client";

// 메인 페이지 (MVP)
// - PoC의 폼/요청/에러 처리 흐름을 유지하면서 사이드바 + 대시보드 레이아웃으로 확장한다.
// - "PDF로 저장" 버튼은 window.print() 를 호출해 브라우저 인쇄 다이얼로그를 띄운다.
//   (서버 PDF 변환 의존성 없이 동일한 결과를 얻는 가장 단순한 방법)

import { useCallback, useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import LoadingProgress from "./components/LoadingProgress";
import type { AnalyzeResponse } from "@/lib/types";

const EXAMPLE_USERNAMES = ["torvalds", "gaearon", "yyx990803"];

export default function Home() {
  const [username, setUsername] = useState("");
  const [representativeCount, setRepresentativeCount] = useState(3);
  const [useLlm, setUseLlm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  const runAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, representativeCount, useLlm }),
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
  }, [username, representativeCount, useLlm]);

  function handlePrint() {
    if (typeof window === "undefined") return;
    window.print();
  }

  return (
    <div className="layout">
      <Sidebar
        username={username}
        onUsernameChange={setUsername}
        representativeCount={representativeCount}
        onRepresentativeCountChange={setRepresentativeCount}
        useLlm={useLlm}
        onUseLlmChange={setUseLlm}
        loading={loading}
        onSubmit={runAnalyze}
      />

      <main className="main">
        <div className="main-toolbar print-hidden">
          <div className="examples">
            <span className="muted small">예시:&nbsp;</span>
            {EXAMPLE_USERNAMES.map((example) => (
              <button
                key={example}
                type="button"
                className="link"
                onClick={() => setUsername(example)}
                disabled={loading}
              >
                {example}
              </button>
            ))}
          </div>
          <div className="toolbar-actions">
            <button
              type="button"
              className="ghost"
              onClick={handlePrint}
              disabled={!result || loading}
            >
              PDF로 저장 / 인쇄
            </button>
          </div>
        </div>

        {loading && <LoadingProgress useLlm={useLlm} />}

        {error && (
          <div className="state-card error">
            <strong>오류</strong>
            <p>{error}</p>
            <p className="muted small">
              GitHub API 제한이나 일시적 네트워크 오류인 경우 잠시 후 다시 시도해주세요.
              동일 username 의 직전 분석 결과가 캐시(10분) 에 남아 있다면 재시도 시 자동으로 캐시된
              결과가 표시됩니다.
            </p>
          </div>
        )}

        {!loading && !error && !result && (
          <div className="state-card empty">
            <h2>GitHub username을 입력하고 분석을 시작하세요</h2>
            <p className="muted">
              사이드바에 username을 입력한 뒤 [분석 시작] 버튼을 누르면 공개 저장소 데이터를 기반으로
              개발 활동 추정 리포트를 생성합니다.
            </p>
            <ul className="muted small">
              <li>분석 자체는 사용자의 <strong>전체 공개 repo</strong> 를 대상으로 진행됩니다. 사이드바의 슬라이더는 <strong>대시보드에 카드로 표시할 대표 repo 수 (3~5)</strong> 를 정합니다.</li>
              <li>대표 repo 는 최신성, description, README, 활동성, 구조 기준으로 자동 선정됩니다.</li>
              <li>LLM 옵션을 켜면 사용자 요약과 repo별 포트폴리오 문장 / 이력서 bullet / 면접 질문을 생성합니다.</li>
              <li>LLM API 키가 없으면 자동으로 규칙 기반 결과만 표시됩니다.</li>
              <li>결과 상단의 [PDF로 저장 / 인쇄] 버튼으로 인쇄형 보고서를 출력할 수 있습니다.</li>
              <li>새로고침하거나 페이지를 떠나도 동일 username 으로 다시 분석하면 10분 이내에는 캐시된 결과가 즉시 표시됩니다.</li>
            </ul>
          </div>
        )}

        {result && <Dashboard data={result} />}
      </main>
    </div>
  );
}
