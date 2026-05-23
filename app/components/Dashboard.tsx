"use client";

import type { AnalyzeResponse, DomainScores } from "@/lib/types";
import RadarChart from "./RadarChart";
import TechStackPanel from "./TechStackPanel";
import ActivityPanel from "./ActivityPanel";
import RepoCard from "./RepoCard";
import { TagCard } from "./TagCard";
import { WarningBanner } from "./WarningBanner";

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

  return (
    <div className="flex flex-col gap-5 p-6 max-w-[1200px]">
      {/* Disclaimer */}
      <div className="bg-[rgba(245,158,11,0.08)] border-l-4 border-l-[#F59E0B] p-3 rounded-r-lg text-sm text-muted-foreground" role="note">
        ⚠ 이 리포트는 GitHub 공개 저장소 데이터를 기반으로 한 추정 결과입니다.
        private repo 활동과 외부 기여는 반영되지 않으며, 결과는 검토 후 사용해주세요.
      </div>

      {/* Headline Card */}
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-sm text-muted-foreground mb-2 font-mono">
          <a
            href={data.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            @{data.username}
          </a>
          {" "}· 공개 repo {data.publicRepos}개 · 주 언어 {data.topLanguage}
          {data.cached && (
            <span className="ml-2 px-2 py-0.5 bg-muted border border-border rounded-full text-xs text-muted-foreground">
              캐시된 결과
            </span>
          )}
        </p>
        <h2 className="text-2xl font-bold mb-3 text-foreground leading-tight">
          {data.llm?.headline || "공개 저장소 기반 개발 활동 추정 리포트"}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{data.summary}</p>
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
        <div className="flex gap-3 overflow-x-auto pb-2">
          {tags.map((tag, i) => (
            <TagCard key={`${tag.name}-${i}`} tag={tag.name} reason={tag.reason} />
          ))}
        </div>
      )}

      {/* Middle Grid: Radar + Tech/Activity */}
      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-2 bg-card border border-border rounded-xl p-6">
          <div className="mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              분야별 점수
            </h3>
            <p className="text-xs text-muted-foreground">(공개 repo 기준 추정)</p>
          </div>
          {radarEmpty ? (
            <p className="text-sm text-muted-foreground">
              대표 저장소에서 분야 신호가 충분히 검출되지 않아 차트를 그릴 수 없습니다.
            </p>
          ) : (
            <RadarChart scores={data.domainScores} />
          )}
          <p className="text-xs text-muted-foreground text-center mt-3">
            점수는 0~100 범위로 정규화한 추정치입니다
          </p>
        </div>

        <div className="col-span-3 flex flex-col gap-5">
          <TechStackPanel
            techStack={data.techStackDistribution}
            languages={data.languageDistribution}
          />
          <ActivityPanel pattern={data.activityPattern} />
        </div>
      </div>

      {/* Repo Cards */}
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            대표 저장소
          </h3>
          <span className="text-xs text-muted-foreground">
            상위 {data.selectedRepos.length}개 · 대표 repo 점수 기준
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
          <div className="grid grid-cols-3 gap-5">
            {data.selectedRepos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
          </div>
        )}
      </div>

      {/* Print-only Footer */}
      <footer className="hidden print:block mt-4 pt-4 border-t border-border text-center">
        <p className="text-xs text-muted-foreground">
          생성 시각: {new Date(data.generatedAt).toLocaleString("ko-KR")} · LLM:{" "}
          {data.llmEnabled
            ? data.llmProvider === "gateway"
              ? "Sookmyung API Gateway"
              : data.llmProvider
            : "사용 안 함"}
          {" "}· GitHub 공개 저장소 기반 추정 결과
        </p>
      </footer>
    </div>
  );
}
