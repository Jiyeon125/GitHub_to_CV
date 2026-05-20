// 활동 패턴 요약 패널
// - 시간대 비율과 일관성 점수를 직관적인 단어/숫자로 표시
// - 단정적 표현(예: "야간형 개발자입니다") 대신 "경향" 으로 표현

import type { ActivityPattern } from "@/lib/types";

type Props = {
  pattern: ActivityPattern;
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function ActivityPanel({ pattern }: Props) {
  return (
    <section className="panel">
      <header className="panel-header">
        <h3>활동 시간대 요약</h3>
      </header>

      {pattern.commit_sample_size === 0 ? (
        <p className="muted small">분석 가능한 commit 데이터가 부족합니다.</p>
      ) : (
        <ul className="kv-list">
          <li>
            <span>야간 (21~03시)</span>
            <strong>{pct(pattern.night_ratio)}</strong>
          </li>
          <li>
            <span>오전 (05~11시)</span>
            <strong>{pct(pattern.morning_ratio)}</strong>
          </li>
          <li>
            <span>주말 비율</span>
            <strong>{pct(pattern.weekend_ratio)}</strong>
          </li>
          <li>
            <span>커밋 일관성</span>
            <strong>{pct(pattern.consistency_score)}</strong>
          </li>
          <li>
            <span>표본 커밋 수</span>
            <strong>{pattern.commit_sample_size}</strong>
          </li>
        </ul>
      )}

      {pattern.activity_tags.length > 0 && (
        <div className="tag-row" style={{ marginTop: "0.6rem" }}>
          {pattern.activity_tags.map((tag) => (
            <span key={tag} className="chip chip-activity">{tag}</span>
          ))}
        </div>
      )}

      <p className="muted xsmall" style={{ marginTop: "0.5rem" }}>
        commit timestamp를 KST(UTC+9)로 환산해 계산한 경향치이며,
        실제 작업 시간대와 차이가 있을 수 있습니다.
      </p>
    </section>
  );
}
