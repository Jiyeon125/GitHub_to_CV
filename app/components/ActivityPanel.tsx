"use client";

import type { ReactNode } from "react";
import { ActivityStatTile } from "./ActivityStatTile";
import InfoTooltip from "./InfoTooltip";
import type { ActivityPattern } from "@/lib/types";

type Props = {
  pattern: ActivityPattern;
};

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// 시스템이 달 수 있는 활동 뱃지와 조건을 표 형태로 보여주는 범례.
function LegendRow({ name, cond }: { name: string; cond: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-foreground">{name}</span>
      <span className="text-muted-foreground shrink-0">{cond}</span>
    </li>
  );
}

function LegendSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-border pt-1.5 first:border-t-0 first:pt-0">
      <p className="mb-1 font-semibold text-foreground">{title}</p>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function ActivityBadgeLegend() {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold text-foreground">활동 뱃지 종류</p>
      <LegendSection title="시간대 (commit 비중 40%↑)">
        <LegendRow name="야간 활동 경향" cond="21~03시" />
        <LegendRow name="오전 활동 경향" cond="05~11시" />
        <LegendRow name="오후/저녁 활동 경향" cond="12~20시" />
        <LegendRow name="시간대 고르게 분포" cond="셋 다 미달" />
      </LegendSection>
      <LegendSection title="요일">
        <LegendRow name="주말 집중형" cond="주말 35%↑" />
        <LegendRow name="주중 집중형" cond="주말 10%↓" />
      </LegendSection>
      <LegendSection title="일관성">
        <LegendRow name="꾸준한 커밋형" cond="0.5 이상" />
        <LegendRow name="단기 몰입형" cond="0.2 미만" />
      </LegendSection>
      <LegendSection title="기타">
        <LegendRow name="최근 활동 활발" cond="최근 30일 내" />
        <LegendRow name="commit 표본 부족" cond="5개 미만" />
      </LegendSection>
    </div>
  );
}

export default function ActivityPanel({ pattern }: Props) {
  if (pattern.commit_sample_size === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          활동 패턴
        </h3>
        <p className="text-sm text-muted-foreground">분석 가능한 commit 데이터가 부족합니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5 lg:p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          활동 패턴
          <InfoTooltip
            label="활동 뱃지 종류 설명"
            align="left"
            panelClassName="w-72"
            content={<ActivityBadgeLegend />}
          />
        </h3>
        <span className="text-xs text-muted-foreground">({pattern.timezone} 기준)</span>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
        <ActivityStatTile
          label="야간 비율"
          value={pct(pattern.night_ratio)}
          proportion={Math.round(pattern.night_ratio * 100)}
          tooltip={
            <InfoTooltip
              label="야간 비율 설명"
              text="선택한 타임존 기준 21시~새벽 3시에 찍힌 commit 의 비율입니다."
            />
          }
        />
        <ActivityStatTile
          label="주말 비율"
          value={pct(pattern.weekend_ratio)}
          proportion={Math.round(pattern.weekend_ratio * 100)}
          tooltip={
            <InfoTooltip
              label="주말 비율 설명"
              text="선택한 타임존 기준 토·일요일에 찍힌 commit 의 비율입니다."
            />
          }
        />
        <ActivityStatTile
          label="일관성"
          value={pct(pattern.consistency_score)}
          proportion={Math.round(pattern.consistency_score * 100)}
          tooltip={
            <InfoTooltip
              label="일관성 지표 설명"
              text="최근 약 12주간 commit 이 여러 날·여러 주에 걸쳐 고르게 분산돼 있을수록 높게 나오는 값입니다. 한두 시점에 몰려 있으면 낮아집니다. (표본이 적으면 신뢰도를 낮춰 보정)"
            />
          }
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
        최근 12주 commit 기준 경향치입니다.
      </p>
    </div>
  );
}
