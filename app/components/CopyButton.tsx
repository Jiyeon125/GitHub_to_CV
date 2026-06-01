"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type Props = {
  // 클립보드에 복사할 텍스트
  text: string;
  // 버튼에 표시할 라벨 (기본: "복사")
  label?: string;
  className?: string;
};

// 화면 전용 복사 버튼. 인쇄/PDF 출력에는 노출되지 않도록 no-print 를 기본 적용한다.
export default function CopyButton({ text, label = "복사", className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 접근 실패(권한/비보안 컨텍스트) 시 조용히 무시한다.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`no-print inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground hover:border-primary/40 ${className}`}
      aria-label={copied ? "복사됨" : `${label} (클립보드로)`}
    >
      {copied ? <Check className="h-3 w-3 text-[#22D3A0]" /> : <Copy className="h-3 w-3" />}
      {copied ? "복사됨" : label}
    </button>
  );
}
