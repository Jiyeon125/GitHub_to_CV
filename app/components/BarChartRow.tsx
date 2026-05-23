"use client";

interface BarChartRowProps {
  label: string;
  value: number;
  color?: string;
  maxValue?: number;
}

export function BarChartRow({ label, value, color = "#7C6AF7", maxValue = 100 }: BarChartRowProps) {
  const percentage = Math.min((value / maxValue) * 100, 100);

  return (
    <div className="flex items-center gap-3 mb-2">
      <div className="w-20 text-xs font-mono text-muted-foreground truncate">{label}</div>
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${color}, #22D3A0)`,
          }}
        />
      </div>
      <div className="w-10 text-xs text-muted-foreground text-right">{value}%</div>
    </div>
  );
}
