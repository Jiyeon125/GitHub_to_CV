"use client";

import {
  Document,
  Font,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { AnalyzeResponse, DomainScores } from "@/lib/types";

Font.register({
  family: "NotoSansKR",
  fonts: [
    { src: "/fonts/NotoSansCJKkr-Regular.otf", fontWeight: 400 },
    { src: "/fonts/NotoSansCJKkr-Bold.otf", fontWeight: 700 },
  ],
});

const DOMAIN_LABELS: Record<keyof DomainScores, string> = {
  frontend: "Frontend",
  backend: "Backend",
  data_ml: "Data/ML",
  mobile: "Mobile",
  devops: "DevOps",
  collaboration: "Collaboration",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingHorizontal: 40,
    paddingBottom: 44,
    fontFamily: "NotoSansKR",
    fontSize: 9.5,
    lineHeight: 1.55,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#111827",
    paddingBottom: 14,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 8,
    color: "#6B7280",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 8,
  },
  meta: {
    fontSize: 9,
    color: "#4B5563",
  },
  notice: {
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
    backgroundColor: "#FFF7ED",
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
    color: "#374151",
  },
  section: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  headline: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
  },
  summary: {
    color: "#374151",
  },
  tagGrid: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    padding: 9,
  },
  tagName: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 3,
  },
  muted: {
    color: "#6B7280",
  },
  twoColumn: {
    display: "flex",
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  column: {
    flex: 1,
  },
  barRow: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  barLabel: {
    width: 86,
    fontSize: 8.5,
    color: "#374151",
  },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E5E7EB",
  },
  barFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7C6AF7",
  },
  barValue: {
    width: 28,
    textAlign: "right",
    fontSize: 8.5,
    color: "#6B7280",
  },
  repoCard: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  repoHeader: {
    display: "flex",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  repoName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#4F46E5",
  },
  badgeRow: {
    display: "flex",
    flexDirection: "row",
    gap: 5,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  badge: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 5,
    fontSize: 7.5,
    color: "#4B5563",
  },
  privateBadge: {
    borderColor: "#F59E0B",
    color: "#B45309",
    backgroundColor: "#FFFBEB",
  },
  chipRow: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 8,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 5,
    fontSize: 7.5,
    color: "#4F46E5",
    backgroundColor: "#EEF2FF",
  },
  subTitle: {
    fontSize: 9,
    fontWeight: 700,
    marginTop: 8,
    marginBottom: 4,
  },
  listItem: {
    marginBottom: 3,
    color: "#374151",
  },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 22,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 6,
    color: "#9CA3AF",
    fontSize: 7.5,
    textAlign: "center",
  },
});

function pct(value: number): string {
  return `${Math.round(value)}%`;
}

function BarRow({ label, value }: { label: string; value: number }) {
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${safeValue}%` }]} />
      </View>
      <Text style={styles.barValue}>{pct(safeValue)}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function PdfReportDocument({ data }: { data: AnalyzeResponse }) {
  const scopeLabel = data.mode === "self" && data.privateIncluded ? "전체 저장소" : "공개 저장소";
  const tags = data.llm?.tags?.length
    ? data.llm.tags
    : data.topTagsCandidates.map((name) => ({ name, reason: "" }));
  const languageTotal = Math.max(
    1,
    data.languageDistribution.reduce((sum, item) => sum + item.count, 0),
  );
  const techDenominator = Math.max(1, data.selectedRepos.length);

  return (
    <Document
      title={`GitHub 개발 활동 분석 리포트 - ${data.username}`}
      author="GitHub 개발 활동 리포트"
      language="ko"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} wrap={false}>
          <Text style={styles.eyebrow}>GITHUB DEVELOPER ACTIVITY REPORT</Text>
          <Text style={styles.title}>GitHub 개발 활동 분석 리포트</Text>
          <Text style={styles.meta}>
            @{data.username} · {scopeLabel} 기준 추정 결과 · 생성 시각{" "}
            {new Date(data.generatedAt).toLocaleString("ko-KR")}
          </Text>
        </View>

        <Text style={styles.notice}>
          이 리포트는 GitHub 저장소의 README, 구조, commit, 언어 정보를 기반으로 한 추정 결과입니다.
          결과는 검토 후 사용하십시오.
        </Text>

        <Section title="요약">
          <Text style={styles.meta}>
            {data.mode === "self" && data.privateIncluded
              ? `총 ${data.publicRepos}개 저장소(private ${data.privateRepoCount}개 포함)`
              : `공개 저장소 ${data.publicRepos}개`}{" "}
            · 주 언어 {data.topLanguage}
          </Text>
          <Text style={styles.headline}>
            {data.llm?.headline || `${scopeLabel} 기반 개발 활동 추정 리포트`}
          </Text>
          <Text style={styles.summary}>{data.summary}</Text>
        </Section>

        {tags.length > 0 && (
          <View style={styles.tagGrid}>
            {tags.slice(0, 4).map((tag, index) => (
              <View key={`${tag.name}-${index}`} style={styles.tag}>
                <Text style={styles.tagName}>#{tag.name}</Text>
                {tag.reason ? <Text style={styles.muted}>{tag.reason}</Text> : null}
              </View>
            ))}
          </View>
        )}

        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Section title="분야별 점수">
              {(Object.entries(data.domainScores) as Array<[keyof DomainScores, number]>).map(
                ([key, value]) => (
                  <BarRow key={key} label={DOMAIN_LABELS[key]} value={value} />
                ),
              )}
            </Section>
          </View>
          <View style={styles.column}>
            <Section title="활동 패턴">
              <BarRow label="야간 비율" value={data.activityPattern.night_ratio * 100} />
              <BarRow label="주말 비율" value={data.activityPattern.weekend_ratio * 100} />
              <BarRow label="일관성" value={data.activityPattern.consistency_score * 100} />
              {data.activityPattern.activity_tags.length > 0 && (
                <Text style={styles.muted}>
                  태그: {data.activityPattern.activity_tags.join(", ")}
                </Text>
              )}
            </Section>
          </View>
        </View>

        <View style={styles.twoColumn}>
          <View style={styles.column}>
            <Section title="기술 스택">
              {data.techStackDistribution.slice(0, 8).map((item) => (
                <BarRow
                  key={item.name}
                  label={item.name}
                  value={(item.count / techDenominator) * 100}
                />
              ))}
            </Section>
          </View>
          <View style={styles.column}>
            <Section title="주요 언어">
              {data.languageDistribution.slice(0, 6).map((item) => (
                <BarRow
                  key={item.language}
                  label={item.language}
                  value={(item.count / languageTotal) * 100}
                />
              ))}
            </Section>
          </View>
        </View>

        <Text style={styles.sectionTitle}>대표 저장소</Text>
        {data.selectedRepos.map((repo) => (
          <View key={repo.id} style={styles.repoCard} wrap={false}>
            <View style={styles.repoHeader}>
              <Link src={repo.html_url} style={styles.repoName}>
                {repo.name}
              </Link>
              <Text style={styles.muted}>점수 {repo.score}/100</Text>
            </View>
            <View style={styles.badgeRow}>
              {repo.private && <Text style={[styles.badge, styles.privateBadge]}>Private</Text>}
              <Text style={styles.badge}>README {repo.readmeReliability.level}</Text>
              <Text style={styles.badge}>분석 {repo.analysisConfidence}</Text>
            </View>
            <Text style={styles.summary}>
              {repo.llm?.project_summary || repo.description || "설명이 제공되지 않은 저장소입니다."}
            </Text>
            {repo.techStack.length > 0 && (
              <View style={styles.chipRow}>
                {repo.techStack.slice(0, 10).map((tech) => (
                  <Text key={tech} style={styles.chip}>
                    {tech}
                  </Text>
                ))}
              </View>
            )}
            {repo.llm?.portfolio_sentence && (
              <>
                <Text style={styles.subTitle}>포트폴리오 문장</Text>
                <Text style={styles.summary}>{repo.llm.portfolio_sentence}</Text>
              </>
            )}
            {repo.llm?.resume_bullets?.length ? (
              <>
                <Text style={styles.subTitle}>이력서 bullet</Text>
                {repo.llm.resume_bullets.slice(0, 3).map((bullet, index) => (
                  <Text key={`${bullet}-${index}`} style={styles.listItem}>
                    · {bullet}
                  </Text>
                ))}
              </>
            ) : null}
            {repo.llm?.interview_questions?.length ? (
              <>
                <Text style={styles.subTitle}>예상 면접 질문</Text>
                {repo.llm.interview_questions.slice(0, 2).map((question, index) => (
                  <Text key={`${question}-${index}`} style={styles.listItem}>
                    {index + 1}. {question}
                  </Text>
                ))}
              </>
            ) : null}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          GitHub 개발 활동 분석 리포트 · {scopeLabel} 기반 추정 결과
        </Text>
      </Page>
    </Document>
  );
}
