"use client";

import { BarChartRow } from "./BarChartRow";

type DistributionItem = { name: string; count: number };

const langColors: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F1E05A",
  Python: "#3572A5",
  Java: "#B07219",
  Go: "#00ADD8",
  Rust: "#DEA584",
  Ruby: "#CC342D",
  PHP: "#4F5D95",
  "C++": "#F34B7D",
  "C#": "#178600",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  HTML: "#E34C26",
  CSS: "#563D7C",
  Shell: "#89E051",
};

type Props = {
  techStack: DistributionItem[];
  languages: Array<{ language: string; count: number }>;
};

export default function TechStackPanel({ techStack, languages }: Props) {
  const techTop = techStack.slice(0, 8);
  const langTop = languages.slice(0, 6);
  const techMax = techTop[0]?.count ?? 1;
  const langMax = langTop[0]?.count ?? 1;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
        기술 스택
      </h3>

      {techTop.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          감지된 기술 스택이 없습니다. 설정 파일이 부족할 수 있습니다.
        </p>
      ) : (
        <div className="space-y-1 mb-6">
          {techTop.map((item) => (
            <BarChartRow
              key={item.name}
              label={item.name}
              value={Math.round((item.count / techMax) * 100)}
            />
          ))}
        </div>
      )}

      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        주요 언어
      </h4>
      {langTop.length === 0 ? (
        <p className="text-sm text-muted-foreground">언어 정보를 가져오지 못했습니다.</p>
      ) : (
        <div className="space-y-1">
          {langTop.map((item) => (
            <BarChartRow
              key={item.language}
              label={item.language}
              value={Math.round((item.count / langMax) * 100)}
              color={langColors[item.language] || "#7C6AF7"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
