"use client";

import { useEffect, useState } from "react";
import { StepNode } from "./StepNode";

const BASE_STEPS = [
  "저장소 목록 수집 중...",
  "대표 저장소 선정 중...",
  "구조 · commit 심층 분석 중...",
  "결과 조합 중...",
];

const LLM_STEP = "LLM 요약 생성 중...";

type Props = { useLlm: boolean };

export default function LoadingProgress({ useLlm }: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = useLlm
    ? [...BASE_STEPS.slice(0, 3), LLM_STEP, BASE_STEPS[3]]
    : BASE_STEPS;

  useEffect(() => {
    setCurrentStep(0);
  }, [steps.length]);

  useEffect(() => {
    if (currentStep >= steps.length - 1) return;

    const delayMs = Math.floor(8000 + Math.random() * 2001); // 8~10초
    const timer = window.setTimeout(() => {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [currentStep, steps.length]);

  const totalMin = useLlm ? 32 : 24;
  const totalMax = useLlm ? 50 : 40;

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-5 h-5 rounded-full border-2 border-border border-t-primary animate-spin" />
          <p className="text-sm font-medium text-foreground">분석 중입니다...</p>
        </div>

        <div className="relative pl-4">
          <div className="absolute left-[4px] top-[5px] bottom-[5px] w-px bg-border" />
          <div className="flex flex-col gap-5">
            {steps.map((label, i) => (
              <StepNode
                key={label}
                status={i < currentStep ? "completed" : i === currentStep ? "active" : "pending"}
                label={label}
              />
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          단계별 안내는 8~10초 간격으로 갱신됩니다. 전체 소요 시간은 보통 {totalMin}~{totalMax}초입니다.
        </p>
      </div>
    </div>
  );
}
