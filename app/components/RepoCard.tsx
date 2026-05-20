// repo 카드
// - 상단: repo 이름/링크 + README 신뢰도 + 분석 신뢰도 badge
// - 본문: 프로젝트 요약, 기술 스택 chip, 포트폴리오 문장, 이력서 bullet
// - 하단: 면접 질문 accordion
// - 단순 PoC 카드(점수 breakdown)도 보존해 details 안에 표시

import type { AnalyzedRepo } from "@/lib/types";
import { Chip, ReliabilityBadge } from "./Badges";

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export default function RepoCard({ repo }: { repo: AnalyzedRepo }) {
  const llm = repo.llm;

  return (
    <article className="repo-card">
      <header className="repo-card-header">
        <h3>
          <a href={repo.html_url} target="_blank" rel="noreferrer">{repo.name}</a>
        </h3>
        <div className="badge-row">
          <ReliabilityBadge level={repo.readmeReliability.level} prefix="README" />
          <ReliabilityBadge level={repo.analysisConfidence} prefix="분석" />
        </div>
      </header>

      <p className="repo-description">
        {llm?.project_summary || repo.description || "설명이 제공되지 않은 저장소입니다."}
      </p>

      {(repo.readmeReliability.level === "low" || repo.readmeReliability.level === "missing") && (
        <p className="muted xsmall repo-disclaimer">
          README가 부족하여 구조/commit 기반 추정 결과입니다. 실제 의도와 다를 수 있습니다.
        </p>
      )}

      {repo.techStack.length > 0 && (
        <div className="chip-row">
          {repo.techStack.slice(0, 10).map((tech) => (
            <Chip key={tech}>{tech}</Chip>
          ))}
        </div>
      )}

      {llm?.core_features && llm.core_features.length > 0 && (
        <div className="repo-section">
          <h4>핵심 기능</h4>
          <ul className="bullet-list">
            {llm.core_features.map((feature, i) => (
              <li key={i}>{feature}</li>
            ))}
          </ul>
        </div>
      )}

      {llm?.portfolio_sentence && (
        <div className="repo-section">
          <h4>포트폴리오 문장</h4>
          <p className="portfolio">{llm.portfolio_sentence}</p>
        </div>
      )}

      {llm?.resume_bullets && llm.resume_bullets.length > 0 && (
        <div className="repo-section">
          <h4>이력서 bullet</h4>
          <ul className="bullet-list">
            {llm.resume_bullets.map((bullet, i) => (
              <li key={i}>{bullet}</li>
            ))}
          </ul>
        </div>
      )}

      {!llm && (
        <p className="muted small">
          LLM 요약이 비활성화되어 있어 규칙 기반 정보만 표시됩니다.
        </p>
      )}

      {llm?.interview_questions && llm.interview_questions.length > 0 && (
        <details className="repo-accordion">
          <summary>예상 면접 질문</summary>
          <ul className="bullet-list">
            {llm.interview_questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </details>
      )}

      <details className="repo-accordion muted small">
        <summary>분석 메타정보</summary>
        <ul className="meta-list">
          <li>점수: {repo.score} / 100</li>
          <li>언어: {repo.language ?? "Unknown"}</li>
          <li>Stars: {repo.stargazers_count} · Forks: {repo.forks_count}</li>
          <li>업데이트: {formatDate(repo.updated_at)}</li>
          {repo.inferenceNotes.length > 0 && (
            <li>추론 메모: {repo.inferenceNotes.join(", ")}</li>
          )}
          {repo.structureSummary.length > 0 && (
            <li>주요 디렉토리: {repo.structureSummary.join(", ")}</li>
          )}
          {repo.readmeReliability.reasons.length > 0 && (
            <li>README 평가: {repo.readmeReliability.reasons.join(" / ")}</li>
          )}
        </ul>
      </details>
    </article>
  );
}
