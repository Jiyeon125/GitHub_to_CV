// 6축 도메인 점수 시각화 (SVG 레이더)
// - 외부 차트 라이브러리 의존을 피하고 가벼운 SVG로 직접 그린다.
// - 점수는 0~100 범위. 5단계 그리드를 동심다각형으로 그린다.
// - 인쇄 모드에서도 그대로 보여야 하므로 SVG는 색상 클래스를 통해 제어.

import type { DomainScores } from "@/lib/types";

const AXES: Array<{ key: keyof DomainScores; label: string }> = [
  { key: "frontend", label: "Frontend" },
  { key: "backend", label: "Backend" },
  { key: "data_ml", label: "Data/ML" },
  { key: "mobile", label: "Mobile" },
  { key: "devops", label: "DevOps" },
  { key: "collaboration", label: "Collab/Docs" },
];

const SIZE = 360;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 60;
const LEVELS = 5;

// 각 축에 대해 (x, y) 좌표 계산. 첫 축은 위쪽(12시 방향).
function point(index: number, ratio: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / AXES.length - Math.PI / 2;
  return {
    x: CENTER + Math.cos(angle) * RADIUS * ratio,
    y: CENTER + Math.sin(angle) * RADIUS * ratio,
  };
}

export default function RadarChart({ scores }: { scores: DomainScores }) {
  const dataPoints = AXES.map((axis, i) => point(i, Math.max(0, Math.min(1, scores[axis.key] / 100))));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";

  return (
    <div className="radar-wrap">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="분야별 점수 레이더 차트">
        {/* 그리드 */}
        {Array.from({ length: LEVELS }).map((_, level) => {
          const ratio = (level + 1) / LEVELS;
          const pts = AXES.map((_, i) => point(i, ratio));
          const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") + " Z";
          return <path key={level} d={path} className="radar-grid" />;
        })}
        {/* 축선 */}
        {AXES.map((axis, i) => {
          const end = point(i, 1);
          return (
            <line
              key={axis.key}
              x1={CENTER}
              y1={CENTER}
              x2={end.x}
              y2={end.y}
              className="radar-axis"
            />
          );
        })}
        {/* 데이터 영역 */}
        <path d={dataPath} className="radar-area" />
        {/* 데이터 점 */}
        {dataPoints.map((p, i) => (
          <circle key={AXES[i]!.key} cx={p.x} cy={p.y} r={3.5} className="radar-point" />
        ))}
        {/* 축 라벨 */}
        {AXES.map((axis, i) => {
          const labelPos = point(i, 1.18);
          return (
            <text
              key={`label-${axis.key}`}
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="radar-label"
            >
              {axis.label} {scores[axis.key]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
