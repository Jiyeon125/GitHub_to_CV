"use client";

import type { AnalyzeResponse, DomainScores } from "@/lib/types";
import RadarChart from "./RadarChart";
import TechStackPanel from "./TechStackPanel";
import ActivityPanel from "./ActivityPanel";
import RepoCard from "./RepoCard";
import { TagCard } from "./TagCard";
import { WarningBanner } from "./WarningBanner";
import CopyButton from "./CopyButton";
import InfoTooltip from "./InfoTooltip";

type Props = {
  data: AnalyzeResponse;
};

function allScoresZero(scores: DomainScores): boolean {
  return Object.values(scores).every((v) => v <= 0);
}

export default function Dashboard({ data }: Props) {
  const llmTags = data.llm?.tags ?? [];
  const fallbackTags = data.topTagsCandidates.map((name) => ({ name, reason: "" }));
  const tags = llmTags.length > 0 ? llmTags : fallbackTags;
  const radarEmpty = allScoresZero(data.domainScores);
  const scopeLabel = data.mode === "self" && data.privateIncluded ? "전체 저장소" : "공개 저장소";

  return (
    <div className="report-root flex w-full flex-col gap-3 p-3 lg:p-4 max-w-[1200px] mx-auto">
      <header className="report-print-title hidden print:block">
        <p className="text-xs font-mono text-muted-foreground mb-2">
          GitHub Developer Activity Report
        </p>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          GitHub 개발 활동 분석 리포트
        </h1>
        <p className="text-sm text-muted-foreground">
          @{data.username} · {scopeLabel} 기준 추정 결과 · 생성 시각{" "}
          {new Date(data.generatedAt).toLocaleString("ko-KR")}
        </p>
      </header>

      {/* Disclaimer */}
      <div className="report-top bg-[rgba(245,158,11,0.08)] border-l-4 border-l-[#F59E0B] p-2.5 rounded-r-lg text-sm text-muted-foreground" role="note">
        ⚠{" "}
        {data.mode === "self" && data.privateIncluded
          ? "이 리포트는 본인 저장소(private 포함) 기반 추정 결과입니다."
          : "이 리포트는 GitHub 공개 저장소 기반 추정 결과입니다."}{" "}
        {data.llm
          ? "요약·포트폴리오 문장·이력서 bullet 등은 AI가 생성한 초안이므로 사용 전 반드시 검토·수정하세요."
          : "결과는 검토 후 사용하십시오."}
      </div>

      {/* Headline Card */}
      <div className="report-headline bg-card border border-border rounded-xl p-4 lg:p-5">
        <p className="text-sm text-muted-foreground mb-2 font-mono">
          <a
            href={data.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            @{data.username}
          </a>
          {" "}·{" "}
          {data.mode === "self" && data.privateIncluded
            ? `총 ${data.publicRepos}개 (private ${data.privateRepoCount}개 포함)`
            : `공개 저장소 ${data.publicRepos}개`}{" "}
          · 주 언어 {data.topLanguage}
          {data.cached && (
            <span className="ml-2 px-2 py-0.5 bg-muted border border-border rounded-full text-xs text-muted-foreground no-print">
              캐시된 결과
            </span>
          )}
        </p>
        <h2 className="text-xl lg:text-2xl font-bold mb-2 text-foreground leading-tight">
          {data.llm?.headline || `${scopeLabel} 기반 개발 활동 추정 리포트`}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{data.summary}</p>
        {data.llm && (
          <div className="no-print mt-3 flex items-center gap-2">
            <CopyButton
              text={`${data.llm.headline}\n\n${data.summary}`}
              label="요약 복사"
            />
          </div>
        )}
      </div>

      {/* Warnings */}
      {data.warnings.length > 0 && (
        <div className="flex flex-col gap-2 no-print">
          {data.warnings.map((warning, i) => (
            <WarningBanner key={i} type="red" message={warning} />
          ))}
        </div>
      )}

      {/* Tag Row */}
      {tags.length > 0 && (
        <div className="report-tag-grid grid grid-cols-2 lg:grid-cols-4 gap-2">
          {tags.map((tag, i) => (
            <TagCard key={`${tag.name}-${i}`} tag={tag.name} reason={tag.reason} />
          ))}
        </div>
      )}

      {/* Middle Grid: Radar + Tech/Activity */}
      <div className="report-middle-grid grid grid-cols-1 lg:grid-cols-5 gap-3 lg:gap-4">
        <div className="report-domain-card lg:col-span-2 bg-card border border-border rounded-xl p-4 lg:p-5">
          <div className="mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5">
              분야별 점수
              <InfoTooltip
                label="분야별 점수 설명"
                text="전체 저장소의 언어 사용량 신호와 대표 저장소의 구조·설정파일 신호를 합산해 6개 분야를 0~100으로 정규화한 상대 점수입니다. 절대적 실력이 아니라 활동 비중을 나타냅니다."
              />
            </h3>
            <p className="text-xs text-muted-foreground">({scopeLabel} 기준 추정 · 0~100)</p>
          </div>
          {radarEmpty ? (
            <p className="text-sm text-muted-foreground">
              대표 저장소에서 분야 신호가 충분히 검출되지 않아 차트를 그릴 수 없습니다.
            </p>
          ) : (
            <RadarChart scores={data.domainScores} />
          )}
        </div>

        <div className="lg:col-span-3 flex flex-col gap-3 lg:gap-4">
          <TechStackPanel
            techStack={data.techStackDistribution}
            languages={data.languageDistribution}
            techDenominator={Math.max(1, data.selectedRepos.length)}
            languageDenominator={Math.max(
              1,
              data.languageDistribution.reduce((sum, item) => sum + item.count, 0),
            )}
          />
          <ActivityPanel pattern={data.activityPattern} />
        </div>
      </div>

      {/* Repo Cards */}
      <div className="report-repos">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            대표 저장소
          </h3>
          <span className="text-xs text-muted-foreground">
            상위 {data.selectedRepos.length}개
          </span>
        </div>

        {data.selectedRepos.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-foreground font-medium mb-1">분석 가능한 대표 저장소가 없습니다.</p>
            <p className="text-sm text-muted-foreground">
              공개 repo 수가 너무 적거나 README/구조 정보가 부족할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="report-repo-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.selectedRepos.map((repo) => (
              <div key={repo.id} className="report-repo-item">
                <RepoCard repo={repo} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Print-only Footer */}
      <footer className="hidden print:block mt-4 pt-4 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          생성 시각: {new Date(data.generatedAt).toLocaleString("ko-KR")} · LLM:{" "}
          {data.llmEnabled
            ? `${
                data.llmProvider === "gateway"
                  ? "Sookmyung API Gateway"
                  : data.llmProvider === "custom"
                    ? "사용자 지정 API"
                    : data.llmProvider
              }${data.llmModel ? ` (${data.llmModel})` : ""}`
            : "사용 안 함"}
          {" "}· GitHub {scopeLabel} 기반 추정 결과
        </p>
      </footer>
    </div>
  );
}
