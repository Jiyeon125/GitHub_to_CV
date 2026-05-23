"use client";

import type { DomainScores, DomainKey } from "@/lib/types";

interface RadarChartProps {
  scores: DomainScores;
}

const DOMAIN_LABEL: Record<DomainKey, string> = {
  frontend: "Frontend",
  backend: "Backend",
  data_ml: "Data·ML",
  mobile: "Mobile",
  devops: "DevOps",
  collaboration: "Collab",
};

const DOMAIN_COLOR: Record<DomainKey, string> = {
  frontend: "#7C6AF7",
  backend: "#22D3A0",
  data_ml: "#F59E0B",
  mobile: "#3178C6",
  devops: "#F87171",
  collaboration: "#F1E05A",
};

export default function RadarChart({ scores }: RadarChartProps) {
  const categories = Object.keys(scores) as DomainKey[];
  const values = categories.map((k) => scores[k]);
  const max = 100;
  const centerX = 150;
  const centerY = 150;
  const radius = 100;
  const angleStep = (2 * Math.PI) / categories.length;

  const getPoint = (value: number, index: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / max) * radius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  const getLabelPoint = (index: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = radius + 30;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  const gridLevels = [33, 66, 100];
  const dataPoints = values.map((value, index) => getPoint(value, index));
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      width="300"
      height="300"
      viewBox="0 0 300 300"
      className="mx-auto text-muted-foreground"
    >
      <defs>
        <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C6AF7" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#22D3A0" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {gridLevels.map((level, i) => {
        const gridPoints = categories.map((_, index) => {
          const angle = angleStep * index - Math.PI / 2;
          const r = (level / max) * radius;
          return { x: centerX + r * Math.cos(angle), y: centerY + r * Math.sin(angle) };
        });
        return (
          <polygon
            key={i}
            points={gridPoints.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="1"
            strokeDasharray={i === gridLevels.length - 1 ? "0" : "3,3"}
          />
        );
      })}

      {categories.map((_, index) => {
        const endPoint = getPoint(100, index);
        return (
          <line
            key={index}
            x1={centerX}
            y1={centerY}
            x2={endPoint.x}
            y2={endPoint.y}
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeWidth="1"
            strokeDasharray="3,3"
          />
        );
      })}

      <polygon
        points={polygonPoints}
        fill="url(#radarGradient)"
        stroke="#7C6AF7"
        strokeWidth="2"
      />

      {categories.map((category, index) => {
        const labelPos = getLabelPoint(index);
        const color = DOMAIN_COLOR[category] ?? "#9090A8";
        const label = DOMAIN_LABEL[category] ?? String(category);
        return (
          <text
            key={category}
            x={labelPos.x}
            y={labelPos.y}
            fill={color}
            fontSize="11"
            fontFamily="JetBrains Mono, ui-monospace, monospace"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {label}
          </text>
        );
      })}

      {dataPoints.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="4"
          fill="#7C6AF7"
          stroke="var(--card)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
