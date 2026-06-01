import { describe, expect, it } from "vitest";

import { buildTagCandidates } from "@/lib/tags";
import type { ActivityPattern, DomainScores } from "@/lib/types";

const activity: ActivityPattern = {
  night_ratio: 0.6,
  morning_ratio: 0,
  weekend_ratio: 0,
  consistency_score: 0.7,
  commit_sample_size: 20,
  activity_tags: ["야간 활동 경향", "꾸준한 커밋형"],
  timezone: "Asia/Seoul",
};

describe("buildTagCandidates", () => {
  it("상위 도메인 라벨과 활동 태그, 다수 사용 기술을 묶는다", () => {
    const domain: DomainScores = {
      frontend: 70,
      backend: 55,
      data_ml: 10,
      mobile: 0,
      devops: 0,
      collaboration: 20,
    };
    const tags = buildTagCandidates(domain, activity, [
      { name: "TypeScript", count: 3 },
      { name: "React", count: 2 },
    ]);
    expect(tags).toContain("프론트엔드 비중 높음");
    expect(tags).toContain("백엔드 비중 높음"); // 2순위지만 >=50 이라 포함
    expect(tags).toContain("야간 활동 경향");
    expect(tags).toContain("TypeScript 다수 사용");
    expect(tags.length).toBeLessThanOrEqual(6);
  });

  it("2순위 도메인 점수가 50 미만이면 제외한다", () => {
    const domain: DomainScores = {
      frontend: 70,
      backend: 40,
      data_ml: 0,
      mobile: 0,
      devops: 0,
      collaboration: 0,
    };
    const tags = buildTagCandidates(domain, activity, []);
    expect(tags).toContain("프론트엔드 비중 높음");
    expect(tags).not.toContain("백엔드 비중 높음");
  });

  it("count 가 1인 기술은 '다수 사용' 태그에 넣지 않는다", () => {
    const domain: DomainScores = { ...{ frontend: 35, backend: 0, data_ml: 0, mobile: 0, devops: 0, collaboration: 0 } };
    const tags = buildTagCandidates(domain, activity, [{ name: "Rust", count: 1 }]);
    expect(tags).not.toContain("Rust 다수 사용");
  });
});
