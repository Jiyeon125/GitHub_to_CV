// 신뢰도 / 레벨 badge 컴포넌트 모음
// - 단일 책임: ReadmeReliabilityLevel 을 컬러 라벨로 변환
// - 색상은 CSS 클래스로만 제어해 인쇄 모드에서도 가독성 유지

import type { ReadmeReliabilityLevel } from "@/lib/types";

const LABELS: Record<ReadmeReliabilityLevel, string> = {
  high: "신뢰도 높음",
  medium: "신뢰도 보통",
  low: "신뢰도 낮음",
  missing: "README 없음",
};

export function ReliabilityBadge({
  level,
  prefix,
}: {
  level: ReadmeReliabilityLevel;
  prefix?: string;
}) {
  return (
    <span className={`badge badge-${level}`}>
      {prefix ? `${prefix} ` : ""}
      {LABELS[level]}
    </span>
  );
}

export function Chip({ children }: { children: React.ReactNode }) {
  return <span className="chip">{children}</span>;
}
