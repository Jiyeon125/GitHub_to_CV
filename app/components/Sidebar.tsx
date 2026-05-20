"use client";

// Sidebar: GitHub username 입력 + 옵션 + 분석 시작 트리거
// - 입력 유효성 검사는 가벼운 형식 체크만 (서버에서 다시 검증)
// - LLM on/off, repo 개수(3~5) 선택 UI 제공
// - 인쇄/PDF 저장 시에는 sidebar 자체를 숨긴다 (@media print)

import { FormEvent } from "react";

export type AnalyzeRequest = {
  username: string;
  representativeCount: number;
  useLlm: boolean;
};

type Props = {
  username: string;
  onUsernameChange: (value: string) => void;
  representativeCount: number;
  onRepresentativeCountChange: (value: number) => void;
  useLlm: boolean;
  onUseLlmChange: (value: boolean) => void;
  loading: boolean;
  onSubmit: () => void;
};

export default function Sidebar({
  username,
  onUsernameChange,
  representativeCount,
  onRepresentativeCountChange,
  useLlm,
  onUseLlmChange,
  loading,
  onSubmit,
}: Props) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    onSubmit();
  }

  return (
    <aside className="sidebar print-hidden">
      <header className="sidebar-header">
        <h1>GitHub 활동 리포트</h1>
        <p className="muted small">
          공개 저장소 데이터를 분석해 개발 활동 추정 리포트를 생성합니다.
        </p>
      </header>

      <form className="sidebar-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>GitHub username</span>
          <input
            value={username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder="예: torvalds"
            aria-label="GitHub username"
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="field">
          <span>분석 대상 repo 수: {representativeCount}</span>
          <input
            type="range"
            min={3}
            max={5}
            step={1}
            value={representativeCount}
            onChange={(event) => onRepresentativeCountChange(Number(event.target.value))}
          />
        </label>

        <label className="field-inline">
          <input
            type="checkbox"
            checked={useLlm}
            onChange={(event) => onUseLlmChange(event.target.checked)}
          />
          <span>LLM 요약 생성</span>
        </label>

        <button type="submit" disabled={loading || !username.trim()} className="primary">
          {loading ? "분석 중..." : "분석 시작"}
        </button>

        <p className="muted small">
          공개 repository만 분석에 사용되며, 결과는 README/구조/commit 기반 추정입니다.
        </p>
        <p className="muted xsmall">
          LLM API 키가 없으면 규칙 기반 결과만 표시됩니다.
        </p>
      </form>
    </aside>
  );
}
