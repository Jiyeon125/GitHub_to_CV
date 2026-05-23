"use client";

import { FormEvent } from "react";
import { GitBranch, Sparkles, Sun, Moon } from "lucide-react";
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
  const { theme, toggleTheme } = useTheme();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    onSubmit();
  }

  return (
    <aside className="w-[280px] h-full bg-sidebar border-r border-sidebar-border flex flex-col p-6 flex-shrink-0 no-print overflow-y-auto">
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
        <div>
          <Label htmlFor="username" className="text-sm text-muted-foreground mb-2 block">
            GitHub username
          </Label>
          <input
            id="username"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder="@torvalds"
            autoComplete="off"
            spellCheck={false}
            aria-label="GitHub username"
            className="w-full bg-input-background border border-border rounded-md px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

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
          disabled={loading || !username.trim()}
          className="w-full py-2.5 px-4 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shadow-[0_0_20px_rgba(124,106,247,0.3)] disabled:shadow-none"
        >
          {loading ? "분석 중..." : "분석 시작"}
        </button>

        <p className="text-xs text-muted-foreground">
          공개 repository만 분석에 사용되며, 결과는 README/구조/commit 기반 추정입니다.
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
