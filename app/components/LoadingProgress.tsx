"use client";

import { useEffect, useMemo, useState } from "react";
import type { AnalyzeStage } from "@/lib/types";
import { StepNode } from "./StepNode";

type Props = {
  useLlm: boolean;
  representativeCount?: number;
  // 서버 스트리밍으로 받은 실제 진행 단계. null 이면 아직 첫 이벤트 전(시작 직후).
  stage?: AnalyzeStage | null;
};

const STAGE_LABELS: Record<AnalyzeStage, string> = {
  repos: "저장소 목록 수집 중...",
  select: "대표 저장소 선정 중...",
  deep: "구조 · commit 심층 분석 중...",
  analyze: "분야 점수 · 활동 패턴 분석 중...",
  llm: "LLM 요약 생성 중...",
};

// 진행 단계는 서버가 실제로 push 하는 단계(stage)에 1:1 로 매핑된다.
// - 단계 라벨/순서는 실제 파이프라인과 동일하므로 "표시 단계 ≠ 실제 단계" 문제가 없다.
// - 진행바는 각 단계의 기준 진행률에서 다음 단계 직전까지 완만히 차오르게 해
//   긴 단계(deep/LLM)에서도 멈춰 보이지 않도록 한다(완료 전까지 100% 도달 안 함).
export default function LoadingProgress({ useLlm, stage }: Props) {
  const order = useMemo<AnalyzeStage[]>(
    () =>
      useLlm
        ? ["repos", "select", "deep", "analyze", "llm"]
        : ["repos", "select", "deep", "analyze"],
    [useLlm],
  );

  const currentIndex = stage ? Math.max(0, order.indexOf(stage)) : 0;

  // 마지막 단계도 (order.length+1) 분모로 나눠 100% 미만에서 대기 → "가짜 100%" 방지.
  const stageFloor = ((currentIndex + 1) / (order.length + 1)) * 100;
  const stageCeil = ((currentIndex + 2) / (order.length + 1)) * 100 - 3;

  const [displayPct, setDisplayPct] = useState(stageFloor);

  // 단계가 올라가면 진행바를 그 단계의 기준값까지 끌어올린다(되돌아가지 않음).
  useEffect(() => {
    setDisplayPct((prev) => Math.max(prev, stageFloor));
  }, [stageFloor]);

  // 같은 단계가 길어질 때 다음 단계 직전까지 천천히 차오르게 한다.
  useEffect(() => {
    const id = window.setInterval(() => {
      setDisplayPct((prev) => (prev < stageCeil ? Math.min(stageCeil, prev + 0.6) : prev));
    }, 400);
    return () => window.clearInterval(id);
  }, [stageCeil]);

  const progress = Math.round(displayPct);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-5 rounded-full border-2 border-border border-t-primary animate-spin" />
          <p className="text-sm font-medium text-foreground">분석 중입니다...</p>
        </div>

        <div className="h-1 bg-border rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="relative pl-4">
          <div className="absolute left-[4px] top-[5px] bottom-[5px] w-px bg-border" />
          <div className="flex flex-col gap-5">
            {order.map((key, i) => (
              <StepNode
                key={key}
                status={i < currentIndex ? "completed" : i === currentIndex ? "active" : "pending"}
                label={STAGE_LABELS[key]}
              />
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          분석 완료까지 보통 20~50초 정도 소요됩니다. 분석 대상이 많을 경우 더 걸릴 수 있습니다.
        </p>
      </div>
    </div>
  );
}
