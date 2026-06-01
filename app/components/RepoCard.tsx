"use client";

import { useState } from "react";
import { ExternalLink, ChevronDown, Lock } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { ReliabilityBadge } from "./ReliabilityBadge";
import { TechChip } from "./TechChip";
import CopyButton from "./CopyButton";
import InfoTooltip from "./InfoTooltip";
import type { AnalyzedRepo } from "@/lib/types";

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("ko-KR");
  } catch {
    return value;
  }
}

// 두 신뢰도 뱃지(README / 분석)의 의미와 등급을 정리한 범례.
function ReliabilityLegend() {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="mb-0.5 font-semibold text-foreground">README 뱃지</p>
        <p className="text-muted-foreground">
          README 충실도 — 길이, 목적·기능·실행·기술 설명, 구조/커밋 일치도로 평가
        </p>
        <p className="mt-0.5 text-foreground">
          high · medium · low · <span className="text-muted-foreground">missing(README 없음)</span>
        </p>
      </div>
      <div className="border-t border-border pt-1.5">
        <p className="mb-0.5 font-semibold text-foreground">분석 뱃지</p>
        <p className="text-muted-foreground">분석 결과 자체의 신뢰도</p>
        <p className="mt-0.5 text-foreground">high · medium · low</p>
      </div>
      <p className="border-t border-border pt-1.5 text-muted-foreground">
        자세한 근거는 카드 하단 <span className="text-foreground">‘분석 메타정보’</span> 에서 확인하세요.
      </p>
    </div>
  );
}

export default function RepoCard({ repo }: { repo: AnalyzedRepo }) {
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const llm = repo.llm;

  return (
    <article className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 hover:bg-muted hover:border-primary/40 hover:shadow-[0_0_0_3px_rgba(124,106,247,0.12)] transition-all duration-200">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <a
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-2 group min-w-0"
          >
            <span className="truncate">{repo.name}</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </a>
          {repo.private && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.12)] text-[#F59E0B] text-[10px] font-semibold uppercase tracking-wider shrink-0"
              aria-label="private 저장소"
              title="private 저장소"
            >
              <Lock className="w-2.5 h-2.5" />
              Private
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <ReliabilityBadge level={repo.readmeReliability.level} label={`README ${repo.readmeReliability.level}`} />
          <ReliabilityBadge level={repo.analysisConfidence} label={`분석 ${repo.analysisConfidence}`} />
          <InfoTooltip
            label="신뢰도 뱃지 설명"
            align="left"
            panelClassName="w-72"
            content={<ReliabilityLegend />}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2">
        {llm?.project_summary || repo.description || "설명이 제공되지 않은 저장소입니다."}
      </p>

      {(repo.readmeReliability.level === "low" || repo.readmeReliability.level === "missing") && (
        <p className="text-xs italic text-muted-foreground/70 flex items-center gap-1.5">
          <span>⚠</span>
          README가 부족하여 구조/commit 기반 추정 결과입니다.
        </p>
      )}

      {repo.techStack.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {repo.techStack.slice(0, 10).map((tech) => (
            <TechChip key={tech} name={tech} />
          ))}
        </div>
      )}

      {llm?.core_features && llm.core_features.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            핵심 기능
          </h4>
          <ul className="space-y-1">
            {llm.core_features.map((feature, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">›</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {llm?.portfolio_sentence && (
        <div className="border-l-4 border-primary bg-primary/5 pl-3 py-2">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              포트폴리오 문장
            </h4>
            <CopyButton text={llm.portfolio_sentence} />
          </div>
          <p className="text-sm text-muted-foreground italic">{llm.portfolio_sentence}</p>
        </div>
      )}

      {llm?.resume_bullets && llm.resume_bullets.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              이력서 bullet
            </h4>
            <CopyButton text={llm.resume_bullets.join("\n")} label="전체 복사" />
          </div>
          <ul className="space-y-1.5">
            {llm.resume_bullets.map((bullet, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-[#22D3A0] mt-0.5 shrink-0">✓</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!llm && (
        <p className="text-sm text-muted-foreground/60">
          LLM 요약이 비활성화되어 있어 규칙 기반 정보만 표시됩니다.
        </p>
      )}

      {llm?.interview_questions && llm.interview_questions.length > 0 && (
        <Collapsible open={questionsOpen} onOpenChange={setQuestionsOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <span>예상 면접 질문</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${questionsOpen ? "rotate-180" : ""}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <ol className="space-y-2 list-decimal list-inside">
              {llm.interview_questions.map((q, i) => (
                <li key={i} className="text-sm text-muted-foreground">{q}</li>
              ))}
            </ol>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Collapsible open={metaOpen} onOpenChange={setMetaOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-muted-foreground/80 transition-colors">
          <span>분석 메타정보</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${metaOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            <li>점수: {repo.score} / 100</li>
            <li>언어: {repo.language ?? "Unknown"}</li>
            <li>Stars: {repo.stargazers_count} · Forks: {repo.forks_count}</li>
            <li>업데이트: {formatDate(repo.updated_at)}</li>
            {repo.inferenceNotes.length > 0 && (
              <li>추론 메모: {repo.inferenceNotes.join(", ")}</li>
            )}
            {repo.readmeReliability.reasons.length > 0 && (
              <li>README 평가: {repo.readmeReliability.reasons.join(" / ")}</li>
            )}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </article>
  );
}
