"use client";

import {
  Circle,
  Defs,
  Document,
  Font,
  G,
  LinearGradient,
  Link,
  Line,
  Page,
  Polygon,
  Rect,
  StyleSheet,
  Stop,
  Svg,
  Text,
  View,
} from "@react-pdf/renderer";
import type {
  AnalyzeResponse,
  DomainScores,
  ReadmeReliabilityLevel,
} from "@/lib/types";

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
  collaboration: "Collab",
};

// PDF 출력 커스텀 지점.
// - 색상 토큰은 화면 대시보드와 통일되어야 한다.
// - 항목 개수 / 페이지 여백은 데이터 분량에 맞춰 조정한다.
const PDF_CONFIG = {
  maxTags: 4,
  maxTechStacks: 6,
  maxLanguages: 5,
  maxRepos: 3,
  maxRepoTechChips: 8,
  maxResumeBullets: 3,
  maxInterviewQuestions: 2,
  pagePaddingTop: 44,
  pagePaddingX: 44,
  pagePaddingBottom: 44,
  baseFontSize: 9.5,
};

const COLORS = {
  textPrimary: "#1A1A24",
  textMuted: "#9090A8",
  textBody: "#374151",
  border: "#E0E0EC",
  surface: "#F8F8FB",
  background: "#FFFFFF",
  primary: "#7C6AF7",
  green: "#22D3A0",
  amber: "#F59E0B",
  blue: "#3178C6",
  red: "#F87171",
  yellow: "#F1E05A",
  noticeBg: "#FEF3E2",
  noticeText: "#92400E",
};

const READMELEVEL_COLOR: Record<ReadmeReliabilityLevel, string> = {
  high: COLORS.green,
  medium: COLORS.primary,
  low: COLORS.red,
  missing: COLORS.textMuted,
};

const TAG_ACCENT_COLORS = [COLORS.primary, COLORS.green, COLORS.blue, COLORS.amber];

const LANGUAGE_PALETTE: Record<string, string> = {
  TypeScript: "#3178C6",
  JavaScript: "#F1E05A",
  Python: "#3572A5",
  Java: "#B07219",
  Go: "#00ADD8",
  Rust: "#DEA584",
  Ruby: "#CC342D",
  PHP: "#4F5D95",
  "C++": "#F34B7D",
  "C#": "#178600",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  HTML: "#E34C26",
  CSS: "#563D7C",
  Shell: "#89E051",
  "Jupyter Notebook": "#DA5B0B",
};

const FALLBACK_LANGUAGE_PALETTE = [
  COLORS.blue,
  COLORS.green,
  COLORS.yellow,
  COLORS.amber,
  COLORS.primary,
  COLORS.textMuted,
];

const styles = StyleSheet.create({
  page: {
    paddingTop: PDF_CONFIG.pagePaddingTop,
    paddingHorizontal: PDF_CONFIG.pagePaddingX,
    paddingBottom: PDF_CONFIG.pagePaddingBottom,
    fontFamily: "NotoSansKR",
    fontSize: PDF_CONFIG.baseFontSize,
    lineHeight: 1.55,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },

  header: {
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 7.5,
    color: COLORS.textMuted,
    letterSpacing: 1.2,
    lineHeight: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: COLORS.textPrimary,
    lineHeight: 1.25,
    marginBottom: 10,
  },
  headerMeta: {
    fontSize: 9,
    color: COLORS.textMuted,
    lineHeight: 1.35,
    marginBottom: 14,
  },
  headerDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  notice: {
    backgroundColor: COLORS.noticeBg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.amber,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 22,
    color: COLORS.noticeText,
  },

  sectionWrap: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: COLORS.textPrimary,
    lineHeight: 1.3,
    marginBottom: 10,
  },

  summaryMeta: {
    fontSize: 9,
    color: COLORS.textMuted,
    lineHeight: 1.35,
    marginBottom: 6,
  },
  headline: {
    fontSize: 16,
    fontWeight: 700,
    color: COLORS.textPrimary,
    lineHeight: 1.3,
    marginBottom: 10,
  },
  summary: {
    fontSize: 10,
    color: COLORS.textPrimary,
    lineHeight: 1.55,
  },

  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  tag: {
    width: "47.5%",
    paddingLeft: 10,
    paddingVertical: 2,
    borderLeftWidth: 3,
  },
  tagName: {
    fontSize: 10,
    fontWeight: 700,
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  tagReason: {
    fontSize: 8.5,
    color: COLORS.textMuted,
    lineHeight: 1.45,
  },

  twoColumn: {
    flexDirection: "row",
    gap: 18,
  },
  column: {
    flex: 1,
  },
  subTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  donutsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  donutItem: {
    alignItems: "center",
    flex: 1,
  },
  donutLabel: {
    fontSize: 8.5,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  activityTagsBox: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  activityTag: {
    fontSize: 8.5,
    color: COLORS.textMuted,
    marginBottom: 2,
  },

  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  barLabel: {
    width: 90,
    fontSize: 8.5,
    color: COLORS.textPrimary,
  },
  barValue: {
    width: 28,
    textAlign: "right",
    fontSize: 8.5,
    color: COLORS.textMuted,
  },

  legendList: {
    marginTop: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendLabel: {
    flex: 1,
    fontSize: 8.5,
    color: COLORS.textPrimary,
  },
  legendValue: {
    fontSize: 8.5,
    color: COLORS.textMuted,
  },

  repoCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  repoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  repoName: {
    fontSize: 12,
    fontWeight: 700,
    color: COLORS.textPrimary,
  },
  privateBadge: {
    fontSize: 7.5,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    color: COLORS.textPrimary,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  badge: {
    fontSize: 7.5,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    color: "#FFFFFF",
  },
  repoSummary: {
    fontSize: 9.5,
    color: COLORS.textPrimary,
    marginBottom: 8,
    lineHeight: 1.5,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginBottom: 10,
  },
  chip: {
    fontSize: 7.5,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  repoDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  repoFieldLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: COLORS.textPrimary,
    marginBottom: 3,
  },
  repoFieldText: {
    fontSize: 9,
    color: COLORS.textPrimary,
    marginBottom: 8,
    lineHeight: 1.5,
  },
  bulletItem: {
    fontSize: 9,
    color: COLORS.textPrimary,
    marginBottom: 2,
    marginLeft: 8,
  },

  footer: {
    position: "absolute",
    left: PDF_CONFIG.pagePaddingX,
    right: PDF_CONFIG.pagePaddingX,
    bottom: 22,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 8,
    fontSize: 7.5,
    color: COLORS.textMuted,
    textAlign: "center",
  },
});

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

// === 차트 ===

// 분야별 점수: 6각 레이더(폴리곤) 차트.
function RadarScoreChart({ scores }: { scores: DomainScores }) {
  const items = Object.keys(DOMAIN_LABELS) as Array<keyof DomainScores>;
  const cx = 110;
  const cy = 100;
  const radius = 65;
  const N = items.length;

  const getPoint = (value: number, index: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / N;
    const ratio = clampPercent(value) / 100;
    return {
      x: cx + radius * ratio * Math.cos(angle),
      y: cy + radius * ratio * Math.sin(angle),
    };
  };

  const getLabelPoint = (index: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / N;
    const lr = radius + 16;
    return {
      x: cx + lr * Math.cos(angle),
      y: cy + lr * Math.sin(angle),
    };
  };

  const gridLevels = [25, 50, 75, 100];
  const dataPoints = items.map((key, i) => getPoint(scores[key], i));
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <Svg width={220} height={200} viewBox="0 0 220 200">
      <Defs>
        <LinearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.55} />
          <Stop offset="100%" stopColor={COLORS.green} stopOpacity={0.35} />
        </LinearGradient>
      </Defs>

      <G>
        {gridLevels.map((level, gi) => {
          const pts = items
            .map((_, i) => getPoint(level, i))
            .map((p) => `${p.x},${p.y}`)
            .join(" ");
          return (
            <Polygon
              key={`grid-${gi}`}
              points={pts}
              fill="none"
              stroke={COLORS.border}
              strokeWidth={0.8}
            />
          );
        })}

        {items.map((_, i) => {
          const ep = getPoint(100, i);
          return (
            <Line
              key={`axis-${i}`}
              x1={cx}
              y1={cy}
              x2={ep.x}
              y2={ep.y}
              stroke={COLORS.border}
              strokeWidth={0.5}
            />
          );
        })}

        <Polygon
          points={polygonPoints}
          fill="url(#radarFill)"
          stroke={COLORS.primary}
          strokeWidth={1.4}
        />

        {dataPoints.map((p, i) => (
          <Circle key={`dot-${i}`} cx={p.x} cy={p.y} r={2.4} fill={COLORS.primary} />
        ))}

        {items.map((key, i) => {
          const lp = getLabelPoint(i);
          return (
            <Text
              key={`label-${key}`}
              x={lp.x}
              y={lp.y + 3}
              fill={COLORS.textPrimary}
              style={{ fontSize: 8 }}
              textAnchor="middle"
            >
              {DOMAIN_LABELS[key]}
            </Text>
          );
        })}
      </G>
    </Svg>
  );
}

// 활동 패턴: 도넛형 원형 진행률.
function CircularProgress({
  value,
  color,
  label,
}: {
  value: number;
  color: string;
  label: string;
}) {
  const size = 62;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = clampPercent(value) / 100;
  const filled = circumference * ratio;
  const rest = Math.max(circumference - filled, 0);

  return (
    <View style={styles.donutItem}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={cx} cy={cy} r={r} fill="none" stroke={COLORS.border} strokeWidth={stroke} />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${rest}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <Text
          x={cx}
          y={cy + 3}
          fill={COLORS.textPrimary}
          textAnchor="middle"
          style={{ fontSize: 10, fontWeight: 700 }}
        >
          {`${Math.round(value)}%`}
        </Text>
      </Svg>
      <Text style={styles.donutLabel}>{label}</Text>
    </View>
  );
}

// 기술 스택용 그라데이션 막대 (보라 → 그린).
function GradientBarRow({
  label,
  percentage,
  index,
}: {
  label: string;
  percentage: number;
  index: number;
}) {
  const trackWidth = 180;
  const height = 6;
  const safe = clampPercent(percentage);
  const fillWidth = (trackWidth * safe) / 100;
  const gradientId = `barFill-${index}`;

  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={{ width: trackWidth }}>
        <Svg width={trackWidth} height={height} viewBox={`0 0 ${trackWidth} ${height}`}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={COLORS.primary} />
              <Stop offset="100%" stopColor={COLORS.green} />
            </LinearGradient>
          </Defs>
          <Rect
            x={0}
            y={0}
            width={trackWidth}
            height={height}
            rx={height / 2}
            ry={height / 2}
            fill={COLORS.border}
          />
          {fillWidth > 0 && (
            <Rect
              x={0}
              y={0}
              width={fillWidth}
              height={height}
              rx={height / 2}
              ry={height / 2}
              fill={`url(#${gradientId})`}
            />
          )}
        </Svg>
      </View>
      <Text style={styles.barValue}>{`${Math.round(safe)}%`}</Text>
    </View>
  );
}

// 주요 언어: 세그먼트 막대 + 범례.
function LanguageDistribution({
  languages,
  total,
}: {
  languages: Array<{ language: string; count: number }>;
  total: number;
}) {
  const top = languages.slice(0, PDF_CONFIG.maxLanguages);
  const trackWidth = 220;
  const height = 10;

  let cursor = 0;
  const segments = top.map((item, i) => {
    const ratio = total === 0 ? 0 : item.count / total;
    const x = cursor * trackWidth;
    const width = ratio * trackWidth;
    cursor += ratio;
    const color =
      LANGUAGE_PALETTE[item.language] ??
      FALLBACK_LANGUAGE_PALETTE[i % FALLBACK_LANGUAGE_PALETTE.length];
    return {
      key: item.language,
      x,
      width,
      color,
      percent: ratio * 100,
    };
  });

  return (
    <View>
      <Svg width={trackWidth} height={height} viewBox={`0 0 ${trackWidth} ${height}`}>
        <Rect
          x={0}
          y={0}
          width={trackWidth}
          height={height}
          rx={height / 2}
          ry={height / 2}
          fill={COLORS.border}
        />
        {segments.map((seg) => (
          <Rect
            key={seg.key}
            x={seg.x}
            y={0}
            width={seg.width}
            height={height}
            fill={seg.color}
          />
        ))}
      </Svg>
      <View style={styles.legendList}>
        {segments.map((seg) => (
          <View key={seg.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
            <Text style={styles.legendLabel}>{seg.key}</Text>
            <Text style={styles.legendValue}>{`${Math.round(seg.percent)}%`}</Text>
          </View>
        ))}
      </View>
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

  const repoCount =
    data.mode === "self" && data.privateIncluded
      ? `총 ${data.publicRepos}개 저장소(private ${data.privateRepoCount}개 포함)`
      : `공개 저장소 ${data.publicRepos}개`;

  return (
    <Document
      title={`GitHub 개발 활동 분석 리포트 - ${data.username}`}
      author="GitHub 개발 활동 리포트"
      language="ko"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header} wrap={false}>
          <Text style={styles.eyebrow}>GITHUB DEVELOPER ACTIVITY REPORT</Text>
          <Text style={styles.title}>GitHub 개발 활동 분석 리포트</Text>
          <Text style={styles.headerMeta}>
            @{data.username} · {scopeLabel} 기준 추정 결과 · 생성 시각{" "}
            {new Date(data.generatedAt).toLocaleString("ko-KR")}
          </Text>
          <View style={styles.headerDivider} />
        </View>

        {/* Notice */}
        <View style={styles.notice} wrap={false}>
          <Text>
            이 리포트는 GitHub 저장소의 README, 구조, commit, 언어 정보를 기반으로 한 추정 결과입니다.
            결과는 검토 후 사용하십시오.
          </Text>
        </View>

        {/* Summary */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>요약</Text>
          <Text style={styles.summaryMeta}>
            {repoCount} · 주 언어 {data.topLanguage}
          </Text>
          <Text style={styles.headline}>
            {data.llm?.headline || `${scopeLabel} 기반 개발 활동 추정 리포트`}
          </Text>
          <Text style={styles.summary}>{data.summary}</Text>
        </View>

        {/* Key Tags */}
        {tags.length > 0 && (
          <View style={styles.sectionWrap} wrap={false}>
            <Text style={styles.sectionTitle}>주요 특징</Text>
            <View style={styles.tagGrid}>
              {tags.slice(0, PDF_CONFIG.maxTags).map((tag, index) => (
                <View
                  key={`${tag.name}-${index}`}
                  style={[
                    styles.tag,
                    { borderLeftColor: TAG_ACCENT_COLORS[index % TAG_ACCENT_COLORS.length] },
                  ]}
                >
                  <Text style={styles.tagName}>#{tag.name}</Text>
                  {tag.reason ? <Text style={styles.tagReason}>{tag.reason}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Scores & Activity */}
        <View style={styles.sectionWrap} wrap={false}>
          <Text style={styles.sectionTitle}>점수 및 활동 패턴</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <Text style={styles.subTitle}>분야별 점수</Text>
              <RadarScoreChart scores={data.domainScores} />
            </View>
            <View style={styles.column}>
              <Text style={styles.subTitle}>활동 패턴</Text>
              <View style={styles.donutsRow}>
                <CircularProgress
                  value={clamp01(data.activityPattern.night_ratio) * 100}
                  color={COLORS.primary}
                  label="야간 비율"
                />
                <CircularProgress
                  value={clamp01(data.activityPattern.weekend_ratio) * 100}
                  color={COLORS.blue}
                  label="주말 비율"
                />
                <CircularProgress
                  value={clamp01(data.activityPattern.consistency_score) * 100}
                  color={COLORS.green}
                  label="일관성"
                />
              </View>
              {data.activityPattern.activity_tags.length > 0 && (
                <View style={styles.activityTagsBox}>
                  {data.activityPattern.activity_tags.map((tag) => (
                    <Text key={tag} style={styles.activityTag}>
                      · {tag}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Tech & Languages */}
        <View style={styles.sectionWrap} wrap={false}>
          <Text style={styles.sectionTitle}>기술 스택 및 언어</Text>
          <View style={styles.twoColumn}>
            <View style={styles.column}>
              <Text style={styles.subTitle}>기술 스택</Text>
              {data.techStackDistribution.slice(0, PDF_CONFIG.maxTechStacks).map((item, index) => (
                <GradientBarRow
                  key={item.name}
                  label={item.name}
                  percentage={(item.count / techDenominator) * 100}
                  index={index}
                />
              ))}
            </View>
            <View style={styles.column}>
              <Text style={styles.subTitle}>주요 언어</Text>
              <LanguageDistribution
                languages={data.languageDistribution}
                total={languageTotal}
              />
            </View>
          </View>
        </View>

        {/* Repositories */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>대표 저장소</Text>
          {data.selectedRepos.slice(0, PDF_CONFIG.maxRepos).map((repo) => (
            <View key={repo.id} style={styles.repoCard} minPresenceAhead={120}>
              <View style={styles.repoHeader}>
                <Link src={repo.html_url} style={styles.repoName}>
                  {repo.name}
                </Link>
                {repo.private && <Text style={styles.privateBadge}>Private</Text>}
              </View>
              <View style={styles.badgeRow}>
                <Text
                  style={[
                    styles.badge,
                    { backgroundColor: READMELEVEL_COLOR[repo.readmeReliability.level] },
                  ]}
                >
                  README {repo.readmeReliability.level}
                </Text>
                <Text
                  style={[
                    styles.badge,
                    { backgroundColor: READMELEVEL_COLOR[repo.analysisConfidence] },
                  ]}
                >
                  분석 {repo.analysisConfidence}
                </Text>
              </View>
              <Text style={styles.repoSummary}>
                {repo.llm?.project_summary ||
                  repo.description ||
                  "설명이 제공되지 않은 저장소입니다."}
              </Text>
              {repo.techStack.length > 0 && (
                <View style={styles.chipRow}>
                  {repo.techStack.slice(0, PDF_CONFIG.maxRepoTechChips).map((tech) => (
                    <Text key={tech} style={styles.chip}>
                      {tech}
                    </Text>
                  ))}
                </View>
              )}

              {(repo.llm?.portfolio_sentence ||
                repo.llm?.resume_bullets?.length ||
                repo.llm?.interview_questions?.length) && (
                <View style={styles.repoDivider} />
              )}

              {repo.llm?.portfolio_sentence && (
                <>
                  <Text style={styles.repoFieldLabel}>포트폴리오 문장</Text>
                  <Text style={styles.repoFieldText}>{repo.llm.portfolio_sentence}</Text>
                </>
              )}

              {repo.llm?.resume_bullets?.length ? (
                <>
                  <Text style={styles.repoFieldLabel}>이력서 항목</Text>
                  <View style={{ marginBottom: 8 }}>
                    {repo.llm.resume_bullets
                      .slice(0, PDF_CONFIG.maxResumeBullets)
                      .map((bullet, index) => (
                        <Text key={`${bullet}-${index}`} style={styles.bulletItem}>
                          · {bullet}
                        </Text>
                      ))}
                  </View>
                </>
              ) : null}

              {repo.llm?.interview_questions?.length ? (
                <>
                  <Text style={styles.repoFieldLabel}>면접 예상 질문</Text>
                  <View>
                    {repo.llm.interview_questions
                      .slice(0, PDF_CONFIG.maxInterviewQuestions)
                      .map((question, index) => (
                        <Text key={`${question}-${index}`} style={styles.bulletItem}>
                          {index + 1}. {question}
                        </Text>
                      ))}
                  </View>
                </>
              ) : null}
            </View>
          ))}
        </View>

        <Text style={styles.footer} fixed>
          GitHub 개발 활동 분석 리포트 · {scopeLabel} 기반 추정 결과
        </Text>
      </Page>
    </Document>
  );
}
