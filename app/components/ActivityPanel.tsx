"use client";

import { ActivityStatTile } from "./ActivityStatTile";
import type { ActivityPattern } from "@/lib/types";

type Props = {
  pattern: ActivityPattern;
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function ActivityPanel({ pattern }: Props) {
  if (pattern.commit_sample_size === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
          활동 패턴
        </h3>
        <p className="text-sm text-muted-foreground">분석 가능한 commit 데이터가 부족합니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          활동 패턴
        </h3>
        <span className="text-xs text-muted-foreground">(KST 기준)</span>
      </div>

      <div className="flex gap-3 mb-4">
        <ActivityStatTile
          label="야간 비율"
          value={pct(pattern.night_ratio)}
          proportion={Math.round(pattern.night_ratio * 100)}
        />
        <ActivityStatTile
          label="주말 비율"
          value={pct(pattern.weekend_ratio)}
          proportion={Math.round(pattern.weekend_ratio * 100)}
        />
        <ActivityStatTile
          label="일관성"
          value={pct(pattern.consistency_score)}
          proportion={Math.round(pattern.consistency_score * 100)}
        />
      </div>

      {pattern.activity_tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pattern.activity_tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1.5 rounded-full bg-[rgba(34,211,160,0.12)] text-[#22D3A0] text-xs border border-[rgba(34,211,160,0.3)]"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground/60 mt-3">
        commit timestamp를 KST(UTC+9)로 환산한 경향치이며 실제와 차이가 있을 수 있습니다.
      </p>
    </div>
  );
}
