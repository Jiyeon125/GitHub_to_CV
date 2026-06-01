"use client";

import { useEffect, useMemo, useState } from "react";
import { StepNode } from "./StepNode";

type Props = { useLlm: boolean; representativeCount?: number };

// 진행 단계와 "대략적 소요 비중(초)".
// - 서버가 실제 진행 이벤트를 push 하지 않으므로 완벽한 동기화는 아니지만,
//   각 단계의 실제 파이프라인 비중에 맞춰 가변 시간을 줘서 체감 정확도를 높인다.
// - 심층 분석 단계는 대표 repo 개수에 비례해 늘어난다(각 repo 당 GitHub 다중 호출).
export default function LoadingProgress({ useLlm, representativeCount = 3 }: Props) {
  const steps = useMemo(() => {
    const deepSeconds = 3 + 1.2 * Math.max(1, representativeCount);
    const head = [
      { label: "저장소 목록 수집 중...", seconds: 3 },
      { label: "대표 저장소 선정 중...", seconds: 2 },
      { label: "구조 · commit 심층 분석 중...", seconds: deepSeconds },
    ];
    const tail = { label: "결과 조합 중...", seconds: 3 };
    return useLlm
      ? [...head, { label: "LLM 요약 생성 중...", seconds: 9 }, tail]
      : [...head, tail];
  }, [useLlm, representativeCount]);

  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    setCurrentStep(0);
  }, [steps.length]);

  useEffect(() => {
    if (currentStep >= steps.length - 1) return;
    const ms = (steps[currentStep]?.seconds ?? 4) * 1000;
    const timer = window.setTimeout(() => {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }, ms);
    return () => window.clearTimeout(timer);
  }, [currentStep, steps]);

  const totalSeconds = steps.reduce((sum, s) => sum + s.seconds, 0);
  const elapsedSeconds = steps
    .slice(0, currentStep)
    .reduce((sum, s) => sum + s.seconds, 0);
  const isLastStep = currentStep >= steps.length - 1;
  // 마지막 단계는 완료(컴포넌트 unmount) 전까지 92% 에서 대기시켜 "가짜 100%"를 피한다.
  const progress = isLastStep
    ? 92
    : Math.round((elapsedSeconds / totalSeconds) * 100);

  const totalMin = Math.round(totalSeconds * 0.8);
  const totalMax = Math.round(totalSeconds * 1.6);

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
            {steps.map((step, i) => (
              <StepNode
                key={step.label}
                status={i < currentStep ? "completed" : i === currentStep ? "active" : "pending"}
                label={step.label}
              />
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-6">
          분석 완료까지 보통 {totalMin}~{totalMax}초 정도 소요됩니다. 분석 대상이 많을 경우 더 걸릴 수 있습니다.
        </p>
      </div>
    </div>
  );
}
