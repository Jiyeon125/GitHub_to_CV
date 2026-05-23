"use client";

// Sidebar: GitHub 로그인 + 분석 옵션 + 분석 시작 트리거
// - 로그인 후 기본 모드는 "본인(self) repo 분석".
// - "다른 username 분석 (테스트용)" 토글을 켜면 게스트/공개 모드로 전환.
//   (이 토글은 발표/제출 단계에서 손쉽게 제거할 수 있도록 한 곳에 모아 둔다.)
// - private 포함 체크박스는 self 모드에서만 노출.
// - 입력 유효성 검사는 가벼운 형식 체크만 (서버에서 다시 검증)
// - 인쇄/PDF 저장 시에는 sidebar 자체를 숨긴다 (@media print)

import { FormEvent } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

export type AnalyzeMode = "self" | "public";

type Props = {
  username: string;
  onUsernameChange: (value: string) => void;
  representativeCount: number;
  onRepresentativeCountChange: (value: number) => void;
  useLlm: boolean;
  onUseLlmChange: (value: boolean) => void;
  mode: AnalyzeMode;
  onModeChange: (value: AnalyzeMode) => void;
  includePrivate: boolean;
  onIncludePrivateChange: (value: boolean) => void;
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
  mode,
  onModeChange,
  includePrivate,
  onIncludePrivateChange,
  loading,
  onSubmit,
}: Props) {
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated" && !!session?.user?.login;
  const sessionLogin = session?.user?.login ?? null;
  const avatarUrl = session?.user?.image ?? null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    onSubmit();
  }

  function handleLogin() {
    signIn("github");
  }

  function handleLogout() {
    signOut({ callbackUrl: "/" });
  }

  // self 모드인데 비로그인이면 자동으로 public 으로 fallback.
  // 이건 page.tsx 에서 동기화하지만 UI 표시도 안전하게 fallback.
  const effectiveMode: AnalyzeMode = mode === "self" && !isAuthed ? "public" : mode;

  const usernameDisabled = effectiveMode === "self";
  const submitDisabled =
    loading ||
    (effectiveMode === "self" ? !isAuthed : !username.trim());

  return (
    <aside className="sidebar print-hidden">
      <header className="sidebar-header">
        <h1>GitHub 활동 리포트</h1>
        <p className="muted small">
          GitHub 저장소 데이터를 분석해 개발 활동 추정 리포트를 생성합니다.
        </p>
      </header>

      <section className="auth-panel">
        {status === "loading" ? (
          <p className="muted small">로그인 상태 확인 중...</p>
        ) : isAuthed ? (
          <div className="auth-card">
            <div className="auth-row">
              {avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="auth-avatar" src={avatarUrl} alt="" />
              )}
              <div className="auth-meta">
                <strong>@{sessionLogin}</strong>
                <span className="muted xsmall">로그인됨</span>
              </div>
              <button
                type="button"
                className="ghost auth-action"
                onClick={handleLogout}
                disabled={loading}
              >
                로그아웃
              </button>
            </div>
          </div>
        ) : (
          <div className="auth-card">
            <button
              type="button"
              className="primary auth-login"
              onClick={handleLogin}
              disabled={loading}
            >
              GitHub 로 로그인
            </button>
            <p className="muted xsmall">
              로그인하면 본인의 private 저장소까지 분석에 포함시킬 수 있고
              GitHub API 호출 한도가 시간당 5,000회로 확장됩니다.
            </p>
          </div>
        )}
      </section>

      <form className="sidebar-form" onSubmit={handleSubmit}>
        {isAuthed && (
          <div className="mode-toggle field">
            <span className="field-label">분석 대상</span>
            <div className="segmented">
              <button
                type="button"
                className={effectiveMode === "self" ? "seg-on" : "seg"}
                onClick={() => onModeChange("self")}
                disabled={loading}
              >
                내 저장소
              </button>
              <button
                type="button"
                className={effectiveMode === "public" ? "seg-on" : "seg"}
                onClick={() => onModeChange("public")}
                disabled={loading}
              >
                다른 사용자 (테스트)
              </button>
            </div>
            <span className="muted xsmall">
              {effectiveMode === "self"
                ? "로그인된 본인 계정을 기준으로 분석합니다."
                : "테스트용으로 다른 username 의 공개 저장소를 분석합니다."}
            </span>
          </div>
        )}

        <label className="field">
          <span>GitHub username</span>
          <input
            value={effectiveMode === "self" ? sessionLogin ?? "" : username}
            onChange={(event) => onUsernameChange(event.target.value)}
            placeholder={effectiveMode === "self" ? sessionLogin ?? "" : "예: torvalds"}
            aria-label="GitHub username"
            autoComplete="off"
            spellCheck={false}
            disabled={usernameDisabled || loading}
          />
          {usernameDisabled && (
            <span className="muted xsmall">로그인된 계정으로 고정됩니다.</span>
          )}
        </label>

        {effectiveMode === "self" && (
          <label className="field-inline">
            <input
              type="checkbox"
              checked={includePrivate}
              onChange={(event) => onIncludePrivateChange(event.target.checked)}
              disabled={loading}
            />
            <span>private 저장소도 분석에 포함</span>
          </label>
        )}
        {effectiveMode === "self" && includePrivate && (
          <p className="muted xsmall private-warning">
            ⚠ private 저장소의 README / 설정 파일 / 최근 commit 메시지 일부가
            Mindlogic API Gateway 를 통해 LLM 으로 전송됩니다. 동의하는 경우에만 사용하세요.
          </p>
        )}

        <label className="field">
          <span>대표 카드로 표시할 repo 수: {representativeCount}</span>
          <input
            type="range"
            min={3}
            max={5}
            step={1}
            value={representativeCount}
            onChange={(event) => onRepresentativeCountChange(Number(event.target.value))}
            disabled={loading}
          />
          <span className="muted xsmall">
            분석 자체는 전체 저장소를 대상으로 진행하고, 그 중 상위 {representativeCount}개만 카드로 보여 줍니다.
          </span>
        </label>

        <label className="field-inline">
          <input
            type="checkbox"
            checked={useLlm}
            onChange={(event) => onUseLlmChange(event.target.checked)}
            disabled={loading}
          />
          <span>LLM 요약 생성</span>
        </label>

        <button type="submit" disabled={submitDisabled} className="primary">
          {loading ? "분석 중..." : "분석 시작"}
        </button>

        <p className="muted small">
          결과는 README / 구조 / commit 기반 추정입니다. LLM API 키가 없으면 규칙 기반 결과만 표시됩니다.
        </p>
      </form>
    </aside>
  );
}
