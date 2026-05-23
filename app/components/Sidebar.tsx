"use client";

import { FormEvent } from "react";
import { GitBranch, Sparkles, Sun, Moon } from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { useTheme } from "../providers";

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
  mode: "self" | "public";
  onModeChange: (value: "self" | "public") => void;
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
  const { theme, toggleTheme } = useTheme();
  const { data: session, status } = useSession();
  const isAuthed = status === "authenticated" && Boolean(session?.user?.login);
  const sessionLogin = session?.user?.login ?? "";
  const effectiveMode: "self" | "public" = isAuthed ? mode : "public";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    onSubmit();
  }

  return (
    <aside className="w-[280px] h-full bg-sidebar border-r border-sidebar-border flex flex-col p-6 shrink-0 no-print overflow-y-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-white" />
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="테마 전환"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Moon className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>
        <h1 className="text-base font-semibold tracking-wide mb-1 text-sidebar-foreground">
          GitHub 활동 리포트
        </h1>
        <p className="text-xs text-muted-foreground">
          공개 저장소 데이터를 분석해 커리어 산출물을 생성합니다
        </p>
      </div>

      <div className="h-px bg-sidebar-border my-2" />

      <form className="flex-1 flex flex-col gap-5 pt-4" onSubmit={handleSubmit}>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          {isAuthed ? (
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-foreground">@{sessionLogin}</p>
                <p className="text-[11px] text-muted-foreground">GitHub 로그인됨</p>
              </div>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                disabled={loading}
                className="px-2.5 py-1 text-[11px] border border-border rounded-md text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-foreground">로그인 안 됨</p>
                <p className="text-[11px] text-muted-foreground">private 분석을 쓰려면 로그인 필요</p>
              </div>
              <button
                type="button"
                onClick={() => signIn("github")}
                disabled={loading}
                className="px-2.5 py-1 text-[11px] border border-primary/40 rounded-md text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
              >
                GitHub 로그인
              </button>
            </div>
          )}
        </div>

        {isAuthed && (
          <div className="rounded-lg border border-border p-2 bg-card">
            <Label className="text-xs text-muted-foreground mb-2 block">분석 대상</Label>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => onModeChange("self")}
                className={`px-2 py-1.5 text-xs rounded-md border transition-colors ${
                  effectiveMode === "self"
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                내 저장소
              </button>
              <button
                type="button"
                onClick={() => onModeChange("public")}
                className={`px-2 py-1.5 text-xs rounded-md border transition-colors ${
                  effectiveMode === "public"
                    ? "border-primary/50 bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                테스트(공개)
              </button>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="username" className="text-sm text-muted-foreground mb-2 block">
            GitHub username
          </Label>
          <input
            id="username"
            value={effectiveMode === "self" ? sessionLogin : username}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder={effectiveMode === "self" ? "@내계정" : "@torvalds"}
            autoComplete="off"
            spellCheck={false}
            aria-label="GitHub username"
            disabled={effectiveMode === "self"}
            className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {effectiveMode === "self" && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              로그인된 본인 계정으로 고정됩니다.
            </p>
          )}
        </div>

        {effectiveMode === "self" && (
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={includePrivate}
              onChange={(e) => onIncludePrivateChange(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground leading-relaxed">
              private 저장소도 분석에 포함 (동의 시에만 사용)
            </span>
          </label>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-sm text-muted-foreground">대표 repo 표시 개수</Label>
            <span className="px-2 py-0.5 bg-muted border border-border rounded text-xs font-mono text-foreground">
              {representativeCount}
            </span>
          </div>
          <Slider
            value={[representativeCount]}
            onValueChange={(value) => onRepresentativeCountChange(value[0])}
            min={3}
            max={5}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-2">
            분석은 전체 공개 repo 대상, 상위 {representativeCount}개만 카드로 표시합니다
          </p>
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="llm-toggle" className="text-sm text-muted-foreground flex items-center gap-2 cursor-pointer">
            {useLlm && <Sparkles className="w-3.5 h-3.5 text-primary" />}
            LLM 요약 생성
          </Label>
          <Switch
            id="llm-toggle"
            checked={useLlm}
            onCheckedChange={onUseLlmChange}
          />
        </div>

        <button
          type="submit"
          disabled={loading || (effectiveMode === "self" ? !sessionLogin : !username.trim())}
          className="w-full py-2.5 px-4 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shadow-[0_0_20px_rgba(124,106,247,0.3)] disabled:shadow-none"
        >
          {loading ? "분석 중..." : "분석 시작"}
        </button>

        <p className="text-xs text-muted-foreground">
          분석 결과는 README/구조/commit 신호를 종합한 추정치이며, 로그인 시에는 본인 저장소(private 선택 포함)로 확장할 수 있습니다.
        </p>
        {!useLlm && (
          <p className="text-xs text-muted-foreground/60">
            LLM API 키가 없으면 규칙 기반 결과만 표시됩니다.
          </p>
        )}
      </form>
    </aside>
  );
}
