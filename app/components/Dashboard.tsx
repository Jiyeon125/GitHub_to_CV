// 메인 대시보드 컨테이너
// - 상단: 추정 결과 disclaimer + headline / summary / warnings / 태그
// - 중단: 좌측 레이더, 우측 기술 스택 + 활동 패널
// - 하단: 대표 repo 카드 리스트
// - 인쇄 모드에서도 동일한 시각적 위계로 표시되도록 panel/card 단위로 묶는다.

import type { AnalyzeResponse, DomainScores } from "@/lib/types";
import RadarChart from "./RadarChart";
import TechStackPanel from "./TechStackPanel";
import ActivityPanel from "./ActivityPanel";
import RepoCard from "./RepoCard";

type Props = {
  data: AnalyzeResponse;
};

function allScoresZero(scores: DomainScores): boolean {
  return Object.values(scores).every((value) => value <= 0);
}

export default function Dashboard({ data }: Props) {
  const llmTags = data.llm?.tags ?? [];
  const fallbackTags = data.topTagsCandidates.map((name) => ({ name, reason: "" }));
  const tags = llmTags.length > 0 ? llmTags : fallbackTags;
  const radarEmpty = allScoresZero(data.domainScores);

  return (
    <div className="dashboard">
      <section className="dashboard-top">
        <div className="disclaimer-banner" role="note">
          이 리포트는 GitHub 공개 저장소 데이터를 기반으로 한 추정 결과입니다.
          private repo 활동과 외부 기여는 반영되지 않으며, 결과는 검토 후 사용해주세요.
        </div>

        <div className="headline-card">
          <p className="headline-meta">
            <a href={data.profileUrl} target="_blank" rel="noreferrer">
              @{data.username}
            </a>{" "}
            · 공개 repo {data.publicRepos}개 · 주 언어 {data.topLanguage}
            {data.cached && <span className="muted small"> · 캐시된 결과</span>}
          </p>
          <h2 className="headline">
            {data.llm?.headline || "공개 저장소 기반 개발 활동 추정 리포트"}
          </h2>
          <p className="summary">{data.summary}</p>
        </div>

        {data.warnings.length > 0 && (
          <div className="warning-box">
            <strong>안내</strong>
            <ul>
              {data.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {tags.length > 0 && (
          <div className="tag-card-row">
            {tags.map((tag, i) => (
              <article key={`${tag.name}-${i}`} className="tag-card">
                <h4>#{tag.name}</h4>
                {tag.reason && <p className="muted small">{tag.reason}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-middle">
        <div className="middle-left panel">
          <header className="panel-header">
            <h3>분야별 점수 (공개 repo 기준 추정)</h3>
          </header>
          {radarEmpty ? (
            <p className="muted small">
              대표 저장소에서 분야 신호가 충분히 검출되지 않아 차트를 그릴 수 없습니다.
              README/설정 파일/디렉토리 구조 정보가 부족할 수 있습니다.
            </p>
          ) : (
            <RadarChart scores={data.domainScores} />
          )}
          <p className="muted xsmall">
            점수는 대표 repo의 기술 스택, 구조, 문서화 정도를 종합해 0~100 범위로 정규화한 추정치입니다.
          </p>
        </div>

        <div className="middle-right">
          <TechStackPanel
            techStack={data.techStackDistribution}
            languages={data.languageDistribution}
          />
          <ActivityPanel pattern={data.activityPattern} />
        </div>
      </section>

      <section className="dashboard-bottom">
        <header className="panel-header" style={{ marginBottom: "0.6rem" }}>
          <h3>대표 저장소 (추정 신뢰도 포함)</h3>
          <span className="muted small">
            상위 {data.selectedRepos.length}개 · 대표 repo 점수 기준
          </span>
        </header>
        {data.selectedRepos.length === 0 ? (
          <div className="state-card empty">
            <p>분석 가능한 대표 저장소가 없습니다.</p>
            <p className="muted small">
              공개 repo 수가 너무 적거나 README/구조 정보가 부족할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="repo-grid">
            {data.selectedRepos.map((repo) => (
              <RepoCard key={repo.id} repo={repo} />
            ))}
          </div>
        )}
      </section>

      <footer className="dashboard-footer print-only">
        <p className="muted xsmall">
          생성 시각: {new Date(data.generatedAt).toLocaleString()} · LLM:{" "}
          {data.llmEnabled ? data.llmProvider : "사용 안 함"} · 본 리포트는 GitHub
          공개 저장소 데이터를 기반으로 한 추정 결과입니다.
        </p>
      </footer>
    </div>
  );
}
