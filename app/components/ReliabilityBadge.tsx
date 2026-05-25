"use client";

interface ReliabilityBadgeProps {
  level: "high" | "medium" | "low" | "missing";
  label: string;
}

export function ReliabilityBadge({ level, label }: ReliabilityBadgeProps) {
  const styles = {
    high: "bg-[rgba(34,211,160,0.12)] text-[#22D3A0] border-[rgba(34,211,160,0.3)]",
    medium: "bg-[rgba(245,158,11,0.12)] text-[#F59E0B] border-[rgba(245,158,11,0.3)]",
    low: "bg-[rgba(248,113,113,0.12)] text-[#F87171] border-[rgba(248,113,113,0.3)]",
    missing: "bg-transparent text-muted-foreground border-border",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${styles[level]}`}>
      {label}
    </span>
  );
}
