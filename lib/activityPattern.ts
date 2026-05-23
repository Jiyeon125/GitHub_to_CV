// 활동 패턴 분석
// - 대표 repo의 최근 commit timestamp만으로 계산하므로 표본이 적을 수 있다.
// - 결과는 "단정"이 아니라 "경향" 으로 표현한다 (UI 텍스트는 별도).
// - commit timestamp는 GitHub이 UTC ISO 문자열로 돌려준다. 한국 사용자 대상 서비스이므로
//   KST(UTC+9) 기준으로 시간대를 환산해 야간/오전/주말을 판단한다.

import type { ActivityPattern, RepoCommit } from "./types";

const KST_OFFSET_HOURS = 9;

// UTC Date 객체를 KST 기준 hour/day 로 변환
function toKstParts(d: Date): { hour: number; day: number } {
  // getTime() 은 UTC ms. 여기에 KST offset 을 더한 새 시각의 UTC 필드를 읽으면
  // 결과적으로 KST 시각의 hour/day 와 같아진다.
  const shifted = new Date(d.getTime() + KST_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    hour: shifted.getUTCHours(),
    day: shifted.getUTCDay(),
  };
}

// 0 ~ 1 비율로 안전 분할 (분모 0 방지)
function ratio(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.round((num / denom) * 100) / 100;
}

// 날짜 분포의 균일성: 활동 일자가 얼마나 고르게 퍼져 있는가
// 기존에는 "활동일/관측일(spanDays)" 단일 비율을 사용했는데,
// 관측 구간이 길고 커밋이 듬성듬성인 사용자에게 과도하게 낮게 나오는 문제가 있었다.
// 현재는 최근 구간에서 "주 단위 분산"을 중심으로 계산해 점수를 완화한다.
function calculateConsistency(commits: RepoCommit[]): number {
  if (commits.length === 0) return 0;

  const dates = commits
    .map((c) => new Date(c.authorDate))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length < 2) return 0;

  const latest = dates[dates.length - 1]!.getTime();

  // 최근 12주 관측창으로 제한: 오래된 한두 커밋 때문에 일관성이 과소평가되는 문제를 완화
  const WINDOW_DAYS = 84;
  const windowStart = latest - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentDates = dates.filter((d) => d.getTime() >= windowStart);
  const targetDates = recentDates.length >= 2 ? recentDates : dates;

  const earliest = targetDates[0]!.getTime();
  const spanDays = Math.max(
    1,
    Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24)) + 1,
  );

  // 활동한 고유 날짜 수 (KST 기준 날짜로 묶기)
  const uniqueDates = new Set(
    targetDates.map((d) => {
      const shifted = new Date(d.getTime() + KST_OFFSET_HOURS * 60 * 60 * 1000);
      return `${shifted.getUTCFullYear()}-${shifted.getUTCMonth()}-${shifted.getUTCDate()}`;
    }),
  );

  // 활동한 고유 주 수 (KST 기준)
  const uniqueWeeks = new Set(
    targetDates.map((d) => {
      const shifted = new Date(d.getTime() + KST_OFFSET_HOURS * 60 * 60 * 1000);
      const dayIndex = Math.floor(shifted.getTime() / (24 * 60 * 60 * 1000));
      return Math.floor(dayIndex / 7);
    }),
  );

  const spanWeeks = Math.max(1, Math.ceil(spanDays / 7));
  const daySpread = uniqueDates.size / spanDays;
  const weekSpread = uniqueWeeks.size / spanWeeks;

  // 주 단위 분산을 더 크게 반영하고, 일 단위 분산은 보조 신호로 사용
  const blended = 0.35 * daySpread + 0.65 * weekSpread;

  // 표본이 아주 적을 때는 신뢰도를 낮추되, 과도하게 깎이지 않게 0.6~1 범위로 완화
  const sampleFactor = Math.min(1, Math.max(0.6, targetDates.length / 10));
  return Math.min(1, Math.round(blended * sampleFactor * 100) / 100);
}

function deriveActivityTags(
  pattern: Omit<ActivityPattern, "activity_tags">,
  hasEnoughSample: boolean,
  hasRecentActivity: boolean,
): string[] {
  const tags: string[] = [];

  if (!hasEnoughSample) {
    tags.push("공개 repo 정보 부족");
    return tags;
  }

  if (pattern.night_ratio >= 0.4) tags.push("야간 활동 경향");
  if (pattern.morning_ratio >= 0.4) tags.push("오전 활동 경향");
  if (pattern.weekend_ratio >= 0.35) tags.push("주말 집중형");

  if (pattern.consistency_score >= 0.5) {
    tags.push("꾸준한 커밋형");
  } else if (pattern.consistency_score > 0 && pattern.consistency_score < 0.2) {
    tags.push("단기 몰입형");
  }

  if (hasRecentActivity) tags.push("최근 활동 활발");

  return tags;
}

// 여러 repo의 commit 을 묶어 사용자 단위 패턴 산출
export function analyzeActivityPattern(commitsByRepo: RepoCommit[][]): ActivityPattern {
  const allCommits = commitsByRepo.flat();
  const valid = allCommits.filter((c) => !Number.isNaN(new Date(c.authorDate).getTime()));

  if (valid.length === 0) {
    return {
      night_ratio: 0,
      morning_ratio: 0,
      weekend_ratio: 0,
      consistency_score: 0,
      commit_sample_size: 0,
      activity_tags: ["공개 repo 정보 부족"],
    };
  }

  let night = 0;
  let morning = 0;
  let weekend = 0;

  for (const commit of valid) {
    const d = new Date(commit.authorDate);
    const { hour, day } = toKstParts(d); // KST 기준 시간대로 환산

    // 야간: 21시 ~ 03시 (KST)
    if (hour >= 21 || hour <= 3) night += 1;
    // 오전: 05시 ~ 11시 (KST)
    if (hour >= 5 && hour <= 11) morning += 1;
    // 주말: 토(6), 일(0)
    if (day === 0 || day === 6) weekend += 1;
  }

  const total = valid.length;
  const partial = {
    night_ratio: ratio(night, total),
    morning_ratio: ratio(morning, total),
    weekend_ratio: ratio(weekend, total),
    consistency_score: calculateConsistency(valid),
    commit_sample_size: total,
  };

  // 최근 30일 내 commit이 하나라도 있으면 "최근 활동 활발"
  const latest = Math.max(...valid.map((c) => new Date(c.authorDate).getTime()));
  const recencyDays = (Date.now() - latest) / (1000 * 60 * 60 * 24);
  const hasRecentActivity = recencyDays <= 30;

  const tags = deriveActivityTags(partial, total >= 5, hasRecentActivity);

  return { ...partial, activity_tags: tags };
}
