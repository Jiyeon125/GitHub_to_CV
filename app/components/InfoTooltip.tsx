"use client";

import { useId } from "react";
import type { ReactNode } from "react";

type Props = {
  // 스크린리더용 설명 (예: "분야별 점수 설명")
  label: string;
  // 간단한 한 줄/문단 설명
  text?: string;
  // 표·목록 등 구조화된 리치 콘텐츠 (text 대신 사용)
  content?: ReactNode;
  className?: string;
  // 툴팁 패널 너비 (Tailwind class). 기본 w-56.
  panelClassName?: string;
  // 패널 정렬: 아이콘 기준 가운데/왼쪽/오른쪽 (가장자리 잘림 방지용)
  align?: "center" | "left" | "right";
};

const ALIGN_CLASS: Record<NonNullable<Props["align"]>, string> = {
  center: "left-1/2 -translate-x-1/2",
  left: "left-0",
  right: "right-0",
};

// 화면에서 "?" 아이콘에 마우스를 올리거나 포커스하면 설명을 보여주는 경량 툴팁.
// - 외부 의존성 없이 CSS group-hover / focus-within 로만 동작.
// - 인쇄/PDF 에는 노출하지 않는다 (no-print).
// - text(간단) 또는 content(표/목록 등 리치) 중 하나를 사용.
export default function InfoTooltip({
  label,
  text,
  content,
  className,
  panelClassName,
  align = "center",
}: Props) {
  const id = useId();
  return (
    <span className={`no-print group relative inline-flex align-middle ${className ?? ""}`}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[9px] font-semibold leading-none text-muted-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        ?
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute top-full z-30 mt-1.5 ${ALIGN_CLASS[align]} ${panelClassName ?? "w-56"} rounded-md border border-border bg-card px-3 py-2.5 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100`}
      >
        {content ?? text}
      </span>
    </span>
  );
}
