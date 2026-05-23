"use client";

interface StepNodeProps {
  status: "completed" | "active" | "pending";
  label: string;
}

export function StepNode({ status, label }: StepNodeProps) {
  const nodeStyles = {
    completed: "bg-[#22D3A0]",
    active: "bg-primary animate-pulse shadow-[0_0_0_8px_rgba(124,106,247,0.2)]",
    pending: "bg-border",
  };

  return (
    <div className="flex items-center gap-3">
      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${nodeStyles[status]}`} />
      <span className={`text-sm ${status === "active" ? "text-foreground font-medium" : "text-muted-foreground"}`}>
        {label}
      </span>
    </div>
  );
}
