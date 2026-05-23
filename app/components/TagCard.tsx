"use client";

interface TagCardProps {
  tag: string;
  reason?: string;
}

export function TagCard({ tag, reason }: TagCardProps) {
  return (
    <div className="min-w-0 h-full bg-muted border border-border rounded-xl p-2.5 hover:border-primary transition-all duration-200">
      <div className="font-semibold text-sm mb-1 text-foreground truncate">#{tag}</div>
      {reason && <div className="text-xs text-muted-foreground line-clamp-2">{reason}</div>}
    </div>
  );
}
