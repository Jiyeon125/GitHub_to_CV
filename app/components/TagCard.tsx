"use client";

interface TagCardProps {
  tag: string;
  reason?: string;
}

export function TagCard({ tag, reason }: TagCardProps) {
  return (
    <div className="flex-shrink-0 bg-muted border border-border rounded-xl p-3 hover:border-primary transition-all duration-200 min-w-[160px]">
      <div className="font-semibold text-sm mb-1 text-foreground">#{tag}</div>
      {reason && <div className="text-xs text-muted-foreground">{reason}</div>}
    </div>
  );
}
