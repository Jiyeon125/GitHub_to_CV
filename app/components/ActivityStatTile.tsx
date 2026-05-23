"use client";

interface ActivityStatTileProps {
  label: string;
  value: string;
  proportion: number;
}

export function ActivityStatTile({ label, value, proportion }: ActivityStatTileProps) {
  return (
    <div className="flex-1 bg-card border border-border rounded-lg p-4">
      <div className="text-xs text-muted-foreground mb-2">{label}</div>
      <div className="text-2xl font-bold mb-3 text-foreground">{value}</div>
      <div className="h-1 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.min(proportion, 100)}%` }}
        />
      </div>
    </div>
  );
}
