// 활동 패턴 분석
// - 대표 repo의 최근 commit timestamp만으로 계산하므로 표본이 적을 수 있다.
// - 결과는 "단정"이 아니라 "경향" 으로 표현한다 (UI 텍스트는 별도).
// - commit timestamp는 GitHub이 UTC ISO 문자열로 돌려준다. 사용자가 고른 타임존
//   (기본 Asia/Seoul) 기준으로 시간대를 환산해 야간/오전/주말을 판단한다.
// - Intl.DateTimeFormat 로 인스턴스별 오프셋을 구하므로 DST(서머타임)도 반영된다.

import type { ActivityPattern, RepoCommit } from "./types";

export const DEFAULT_TIMEZONE = "Asia/Seoul";

// 주어진 IANA 타임존으로 UTC Date 를 "벽시계(wall clock)" 시각으로 환산하는 함수를 만든다.
// 반환된 Date 는 getUTC* 로 읽으면 해당 타임존의 로컬 시각/요일/날짜를 돌려준다.
function makeZoneShifter(timeZone: string): (d: Date) => Date {
  let dtf: Intl.DateTimeFormat;
  try {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    // 잘못된 타임존 문자열이면 기본값으로 안전 복구.
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: DEFAULT_TIMEZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  return (d: Date) => {
    const parts = dtf.formatToParts(d);
    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== "literal") map[p.type] = Number(p.value);
    }
    // 타임존 로컬 시각을 UTC 필드로 옮겨 담은 Date.
    const asUtc = Date.UTC(
      map.year ?? 1970,
      (map.month ?? 1) - 1,
      map.day ?? 1,
      map.hour ?? 0,
      map.minute ?? 0,
      map.second ?? 0,
    );
    return new Date(asUtc);
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
function calculateConsistency(commits: RepoCommit[], shift: (d: Date) => Date): number {
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

  // 활동한 고유 날짜 수 (선택 타임존 기준 날짜로 묶기)
  const uniqueDates = new Set(
    targetDates.map((d) => {
      const shifted = shift(d);
      return `${shifted.getUTCFullYear()}-${shifted.getUTCMonth()}-${shifted.getUTCDate()}`;
    }),
  );

  // 활동한 고유 주 수 (선택 타임존 기준)
  const uniqueWeeks = new Set(
    targetDates.map((d) => {
      const shifted = shift(d);
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
  pattern: Omit<ActivityPattern, "activity_tags" | "timezone">,
  hasEnoughSample: boolean,
  hasRecentActivity: boolean,
): string[] {
  const tags: string[] = [];

  if (!hasEnoughSample) {
    tags.push("commit 표본 부족");
    return tags;
  }

  // 시간대 경향: 두드러진 구간이 있으면 해당 태그를, 아무 구간도 두드러지지 않으면
  // "시간대 고르게 분포" 를 달아 한쪽으로만 몰려 보이지 않게 한다.
  let hasTimeTag = false;
  if (pattern.night_ratio >= 0.4) {
    tags.push("야간 활동 경향");
    hasTimeTag = true;
  }
  if (pattern.morning_ratio >= 0.4) {
    tags.push("오전 활동 경향");
    hasTimeTag = true;
  }
  if (pattern.afternoon_ratio >= 0.4) {
    tags.push("오후/저녁 활동 경향");
    hasTimeTag = true;
  }
  if (!hasTimeTag) tags.push("시간대 고르게 분포");

  // 요일 경향: 주말 집중 / 주중 집중 두 방향을 모두 표기.
  if (pattern.weekend_ratio >= 0.35) {
    tags.push("주말 집중형");
  } else if (pattern.weekend_ratio <= 0.1) {
    tags.push("주중 집중형");
  }

  if (pattern.consistency_score >= 0.5) {
    tags.push("꾸준한 커밋형");
  } else if (pattern.consistency_score > 0 && pattern.consistency_score < 0.2) {
    tags.push("단기 몰입형");
  }

  if (hasRecentActivity) tags.push("최근 활동 활발");

  return tags;
}

// 여러 repo의 commit 을 묶어 사용자 단위 패턴 산출
// - timeZone: IANA 타임존 문자열 (기본 Asia/Seoul). 야간/오전/주말 판정 기준.
export function analyzeActivityPattern(
  commitsByRepo: RepoCommit[][],
  timeZone: string = DEFAULT_TIMEZONE,
): ActivityPattern {
  const shift = makeZoneShifter(timeZone);
  const allCommits = commitsByRepo.flat();
  const valid = allCommits.filter((c) => !Number.isNaN(new Date(c.authorDate).getTime()));

  if (valid.length === 0) {
    return {
      night_ratio: 0,
      morning_ratio: 0,
      afternoon_ratio: 0,
      weekend_ratio: 0,
      consistency_score: 0,
      commit_sample_size: 0,
      activity_tags: ["commit 표본 부족"],
      timezone: timeZone,
    };
  }

  let night = 0;
  let morning = 0;
  let afternoon = 0;
  let weekend = 0;

  for (const commit of valid) {
    const shifted = shift(new Date(commit.authorDate));
    const hour = shifted.getUTCHours();
    const day = shifted.getUTCDay();

    // 야간: 21시 ~ 03시
    if (hour >= 21 || hour <= 3) night += 1;
    // 오전: 05시 ~ 11시
    if (hour >= 5 && hour <= 11) morning += 1;
    // 오후/저녁: 12시 ~ 20시
    if (hour >= 12 && hour <= 20) afternoon += 1;
    // 주말: 토(6), 일(0)
    if (day === 0 || day === 6) weekend += 1;
  }

  const total = valid.length;
  const partial = {
    night_ratio: ratio(night, total),
    morning_ratio: ratio(morning, total),
    afternoon_ratio: ratio(afternoon, total),
    weekend_ratio: ratio(weekend, total),
    consistency_score: calculateConsistency(valid, shift),
    commit_sample_size: total,
  };

  // 최근 30일 내 commit이 하나라도 있으면 "최근 활동 활발"
  const latest = Math.max(...valid.map((c) => new Date(c.authorDate).getTime()));
  const recencyDays = (Date.now() - latest) / (1000 * 60 * 60 * 24);
  const hasRecentActivity = recencyDays <= 30;

  const tags = deriveActivityTags(partial, total >= 5, hasRecentActivity);

  return { ...partial, activity_tags: tags, timezone: timeZone };
}
