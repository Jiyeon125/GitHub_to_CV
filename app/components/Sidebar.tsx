"use client";

import { FormEvent, useState } from "react";
import { GitBranch, Sparkles, Sun, Moon } from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import { Switch } from "./ui/switch";
import { useTheme } from "../providers";
import { LLM_MODEL_PRESETS, type LlmConfig } from "@/lib/llm";

export type AnalyzeRequest = {
  username: string;
  representativeCount: number;
  useLlm: boolean;
  llmConfig: LlmConfig;
};

type Props = {
  username: string;
  onUsernameChange: (value: string) => void;
  representativeCount: number;
  onRepresentativeCountChange: (value: number) => void;
  useLlm: boolean;
  onUseLlmChange: (value: boolean) => void;
  llmConfig: LlmConfig;
  onLlmConfigChange: (value: LlmConfig) => void;
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
  llmConfig,
  onLlmConfigChange,
  mode,
  onModeChange,
  includePrivate,
  onIncludePrivateChange,
  loading,
  onSubmit,
}: Props) {
  // API key 가시성 토글 (마우스로 잠깐 확인할 수 있게)
  const [showApiKey, setShowApiKey] = useState(false);
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
    <aside className="w-[240px] xl:w-[280px] h-full bg-sidebar border-r border-sidebar-border flex flex-col p-5 xl:p-6 shrink-0 no-print overflow-y-auto">
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
          내 저장소 데이터를 분석해 커리어 산출물을 생성합니다
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
                <p className="text-xs font-medium text-foreground">로그인되지 않음</p>
                <p className="text-[11px] text-muted-foreground">본인 private 저장소를 분석하려면 로그인이 필요합니다.</p>
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
            min={1}
            max={5}
            step={1}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {effectiveMode === "self" && includePrivate
              ? `분석은 본인 전체 저장소(private 포함) 대상, 상위 ${representativeCount}개만 카드로 표시합니다`
              : effectiveMode === "self"
                ? `분석은 본인 전체 공개 저장소 대상, 상위 ${representativeCount}개만 카드로 표시합니다`
                : `분석은 전체 공개 저장소 대상, 상위 ${representativeCount}개만 카드로 표시합니다`}
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

        {useLlm && (
          <div className="rounded-lg border border-border bg-card p-2.5 flex flex-col gap-2.5">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                LLM 모델
              </Label>
              <div className="grid grid-cols-1 gap-1">
                {LLM_MODEL_PRESETS.map((preset) => {
                  const active = llmConfig.choice === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        onLlmConfigChange({
                          choice: preset.id,
                          apiKey: null,
                          baseUrl: null,
                          model: null,
                        })
                      }
                      className={`text-left px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                        active
                          ? "border-primary/50 bg-primary/15 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span className="block font-medium">{preset.label}</span>
                      <span className="block text-[10px] text-muted-foreground mt-0.5">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    onLlmConfigChange({
                      choice: "custom",
                      apiKey: llmConfig.apiKey ?? "",
                      baseUrl: llmConfig.baseUrl ?? "",
                      model: llmConfig.model ?? "",
                    })
                  }
                  className={`text-left px-2.5 py-1.5 rounded-md border text-xs transition-colors ${
                    llmConfig.choice === "custom"
                      ? "border-primary/50 bg-primary/15 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span className="block font-medium">직접 입력 (Custom)</span>
                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                    OpenAI 호환 API 키를 직접 사용
                  </span>
                </button>
              </div>
            </div>

            {llmConfig.choice === "custom" && (
              <div className="flex flex-col gap-2 pt-1 border-t border-border">
                <div>
                  <Label htmlFor="llm-key" className="text-[11px] text-muted-foreground mb-1 block">
                    API Key
                  </Label>
                  <div className="flex gap-1">
                    <input
                      id="llm-key"
                      type={showApiKey ? "text" : "password"}
                      value={llmConfig.apiKey ?? ""}
                      onChange={(e) =>
                        onLlmConfigChange({ ...llmConfig, apiKey: e.target.value })
                      }
                      placeholder="sk-..."
                      autoComplete="off"
                      spellCheck={false}
                      className="flex-1 bg-input-background border border-border rounded-md px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey((v) => !v)}
                      className="px-2 text-[10px] border border-border rounded-md text-muted-foreground hover:bg-muted transition-colors"
                    >
                      {showApiKey ? "숨김" : "보기"}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">
                    키는 서버 호출에만 사용되며 저장되지 않습니다. 페이지를 새로고침하면 사라집니다.
                  </p>
                </div>

                <div>
                  <Label htmlFor="llm-base" className="text-[11px] text-muted-foreground mb-1 block">
                    Base URL (선택)
                  </Label>
                  <input
                    id="llm-base"
                    type="text"
                    value={llmConfig.baseUrl ?? ""}
                    onChange={(e) =>
                      onLlmConfigChange({ ...llmConfig, baseUrl: e.target.value })
                    }
                    placeholder="https://api.openai.com/v1"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full bg-input-background border border-border rounded-md px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div>
                  <Label htmlFor="llm-model" className="text-[11px] text-muted-foreground mb-1 block">
                    Model
                  </Label>
                  <input
                    id="llm-model"
                    type="text"
                    value={llmConfig.model ?? ""}
                    onChange={(e) =>
                      onLlmConfigChange({ ...llmConfig, model: e.target.value })
                    }
                    placeholder="gpt-4o"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full bg-input-background border border-border rounded-md px-2 py-1.5 text-[11px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (effectiveMode === "self" ? !sessionLogin : !username.trim())}
          className="w-full py-2.5 px-4 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shadow-[0_0_20px_rgba(124,106,247,0.3)] disabled:shadow-none"
        >
          {loading ? "분석 중..." : "분석 시작"}
        </button>

        <p className="text-xs text-muted-foreground">
          결과는 README · 구조 · commit 신호를 종합한 추정치이며, 검토 후 사용하십시오.
        </p>
      </form>
    </aside>
  );
}
