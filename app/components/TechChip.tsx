"use client";

interface TechChipProps {
  name: string;
  color?: string;
}

const techColors: Record<string, string> = {
  React: "#61DAFB",
  TypeScript: "#3178C6",
  JavaScript: "#F1E05A",
  Python: "#3572A5",
  Node: "#22D3A0",
  "Node.js": "#22D3A0",
  Vue: "#42b883",
  "Vue.js": "#42b883",
  Next: "#a5b4fc",
  "Next.js": "#a5b4fc",
  Go: "#00ADD8",
  Rust: "#DEA584",
  Java: "#B07219",
  Kotlin: "#A97BFF",
  Swift: "#F05138",
  Docker: "#2496ED",
  Kubernetes: "#326CE5",
};

export function TechChip({ name, color }: TechChipProps) {
  const techColor = color || techColors[name];

  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted border border-border text-xs font-mono whitespace-nowrap transition-colors hover:border-primary"
      style={techColor ? { borderColor: techColor + "40", color: techColor } : undefined}
    >
      {name}
    </span>
  );
}
