"use client";

import { AlertTriangle } from "lucide-react";

interface WarningBannerProps {
  type: "amber" | "red";
  message: string;
}

export function WarningBanner({ type, message }: WarningBannerProps) {
  const styles = {
    amber: "bg-[rgba(245,158,11,0.08)] border-l-[#F59E0B] text-muted-foreground",
    red: "bg-[rgba(248,113,113,0.08)] border-l-[#F87171] text-muted-foreground",
  };

  return (
    <div className={`${styles[type]} border-l-4 p-4 flex items-center gap-3 text-sm rounded-r-lg`}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
