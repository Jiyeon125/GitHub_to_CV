"use client";

// 분석 진행 중 사용자에게 "지금 어디까지 왔는지" 를 보여 주는 컴포넌트.
// - 서버 라우트는 단일 POST 응답이라 실시간 단계 푸시가 불가능하므로,
//   클라이언트에서 6초 단위로 단계 메시지를 자동 전환한다.
// - 마지막 단계까지 도달하면 마지막 메시지를 유지하면서 점(...) 만 깜빡이게 한다.
// - LLM 옵션 ON/OFF 에 따라 마지막 단계 문구를 다르게 표시한다.

import { useEffect, useMemo, useState } from "react";

type Props = {
  useLlm: boolean;
};

const BASE_STAGES = [
  "1단계: 공개 저장소 목록을 수집하는 중입니다...",
  "2단계: 대표 저장소를 선정하는 중입니다...",
  "3단계: 선정된 저장소의 README, commit, 구조를 분석하는 중입니다...",
  "4단계: 분야별 점수와 활동 패턴을 계산하는 중입니다...",
];

const STAGE_INTERVAL_MS = 6_000;

export default function LoadingProgress({ useLlm }: Props) {
  const stages = useMemo(() => {
    return useLlm
      ? [...BASE_STAGES, "5단계: LLM 으로 요약과 포트폴리오 문장을 생성하는 중입니다..."]
      : [...BASE_STAGES, "5단계: 결과를 정리하는 중입니다..."];
  }, [useLlm]);

  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    setStageIndex(0);
    const id = window.setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, stages.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [stages.length]);

  return (
    <div className="state-card loading-card" role="status" aria-live="polite">
      <div className="loading-header">
        <div className="loading-spinner" aria-hidden />
        <strong>분석 중입니다</strong>
      </div>

      <p className="loading-current">{stages[stageIndex]}</p>

      <ol className="loading-steps">
        {stages.map((stage, i) => (
          <li
            key={stage}
            className={
              i < stageIndex ? "step-done" : i === stageIndex ? "step-active" : "step-pending"
            }
          >
            <span className="step-marker" aria-hidden>
              {i < stageIndex ? "✓" : i === stageIndex ? "•" : "·"}
            </span>
            <span>{stage.replace(/^\d+단계:\s*/, "")}</span>
          </li>
        ))}
      </ol>

      <p className="muted small loading-hint">
        사용자 repo 수에 따라 30초 ~ 2분 정도 걸릴 수 있습니다.
        <br />
        <strong>새로고침하시면 진행 상태는 사라지지만</strong>, 동일 username 으로 다시 분석하면 10분
        이내에는 캐시된 결과가 즉시 표시됩니다.
      </p>
    </div>
  );
}
