import { describe, expect, it } from "vitest";

import { analyzeActivityPattern } from "@/lib/activityPattern";
import type { RepoCommit } from "@/lib/types";

function commitsAt(iso: string, count: number): RepoCommit[] {
  return Array.from({ length: count }, (_, i) => ({
    sha: `sha-${iso}-${i}`,
    message: "chore: work",
    authorDate: iso,
  }));
}

describe("analyzeActivityPattern", () => {
  it("commit 이 없으면 0 비율과 표본 부족 태그를 반환한다", () => {
    const result = analyzeActivityPattern([]);
    expect(result.commit_sample_size).toBe(0);
    expect(result.night_ratio).toBe(0);
    expect(result.activity_tags).toEqual(["commit 표본 부족"]);
  });

  it("KST 환산 후 야간(21~03시) 비율을 계산한다", () => {
    // UTC 18:00 + 9h = KST 03:00 → 야간
    const result = analyzeActivityPattern([commitsAt("2025-05-01T18:00:00Z", 5)]);
    expect(result.night_ratio).toBe(1);
    expect(result.morning_ratio).toBe(0);
    expect(result.activity_tags).toContain("야간 활동 경향");
  });

  it("KST 환산 후 오전(05~11시) 비율을 계산한다", () => {
    // UTC 20:00 + 9h = KST 05:00 → 오전
    const result = analyzeActivityPattern([commitsAt("2025-05-01T20:00:00Z", 5)]);
    expect(result.morning_ratio).toBe(1);
    expect(result.night_ratio).toBe(0);
    expect(result.activity_tags).toContain("오전 활동 경향");
  });

  it("주말(KST 기준 토/일) 비율을 계산한다", () => {
    // 2025-05-03 은 토요일. 01:00Z + 9h = 10:00 KST 토요일
    const result = analyzeActivityPattern([commitsAt("2025-05-03T01:00:00Z", 5)]);
    expect(result.weekend_ratio).toBe(1);
  });

  it("표본이 5개 미만이면 표본 부족 태그만 남는다", () => {
    const result = analyzeActivityPattern([commitsAt("2025-05-01T18:00:00Z", 3)]);
    expect(result.commit_sample_size).toBe(3);
    expect(result.activity_tags).toEqual(["commit 표본 부족"]);
  });

  it("잘못된 날짜 문자열은 무시한다", () => {
    const result = analyzeActivityPattern([
      [{ sha: "x", message: "m", authorDate: "not-a-date" }],
    ]);
    expect(result.commit_sample_size).toBe(0);
  });

  it("타임존 인자에 따라 시간대 분류가 달라진다", () => {
    // UTC 18:00 → KST 03:00(야간), 뉴욕(EDT, UTC-4) 14:00(오전 아님)
    const commits = [commitsAt("2025-05-01T18:00:00Z", 5)];
    const kst = analyzeActivityPattern(commits, "Asia/Seoul");
    const ny = analyzeActivityPattern(commits, "America/New_York");
    expect(kst.night_ratio).toBe(1);
    expect(ny.night_ratio).toBe(0);
    expect(kst.timezone).toBe("Asia/Seoul");
    expect(ny.timezone).toBe("America/New_York");
  });

  it("잘못된 타임존은 기본값으로 안전 복구한다", () => {
    const result = analyzeActivityPattern([commitsAt("2025-05-01T18:00:00Z", 5)], "Not/AZone");
    // 기본값(Asia/Seoul)으로 환산되어 야간으로 분류
    expect(result.night_ratio).toBe(1);
  });
});
