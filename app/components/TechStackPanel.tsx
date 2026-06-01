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
  techDenominator: number;
  languageDenominator: number;
};

export default function TechStackPanel({
  techStack,
  languages,
  techDenominator,
  languageDenominator,
}: Props) {
  const techTop = techStack.slice(0, 8);
  const langTop = languages.slice(0, 6);
  const safeTechDenominator = Math.max(1, techDenominator);
  const safeLanguageDenominator = Math.max(1, languageDenominator);

  return (
    <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        기술 스택
      </h3>

      {techTop.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          감지된 기술 스택이 없습니다. package.json 등 의존성 파일이 없는 저장소일 수 있습니다.
        </p>
      ) : (
        <>
          <div className="space-y-1 mb-2">
            {techTop.map((item) => (
              <BarChartRow
                key={item.name}
                label={item.name}
                value={Math.round((item.count / safeTechDenominator) * 100)}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mb-4">
            대표 저장소 {safeTechDenominator}개 중 해당 스택이 감지된 비율
          </p>
        </>
      )}

      <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        주요 언어
      </h4>
      {langTop.length === 0 ? (
        <p className="text-sm text-muted-foreground">언어 정보를 가져오지 못했습니다.</p>
      ) : (
        <>
          <div className="space-y-1 mb-2">
            {langTop.map((item) => (
              <BarChartRow
                key={item.language}
                label={item.language}
                value={Math.round((item.count / safeLanguageDenominator) * 100)}
                color={langColors[item.language] || "#7C6AF7"}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            전체 저장소 중 해당 언어가 주 언어인 비율
          </p>
        </>
      )}
    </div>
  );
}
