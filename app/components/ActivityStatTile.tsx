"use client";

import type { ReactNode } from "react";

interface ActivityStatTileProps {
  label: string;
  value: string;
  proportion: number;
  tooltip?: ReactNode;
}

export function ActivityStatTile({ label, value, proportion, tooltip }: ActivityStatTileProps) {
  return (
    <div className="min-w-0 bg-card border border-border rounded-lg p-3 sm:p-4">
      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
        <span className="truncate">{label}</span>
        {tooltip}
      </div>
      <div className="text-xl sm:text-2xl font-bold mb-3 text-foreground">{value}</div>
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.min(proportion, 100)}%` }}
        />
      </div>
    </div>
  );
}
