import { describe, expect, it } from "vitest";

import {
  computeShallowScore,
  refineScoreWithDeepData,
  rankRepresentativeRepos,
  getLanguageDistribution,
  getTopLanguage,
  type GitHubRepo,
  type ScoredRepo,
} from "@/lib/scoring";

function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id: 1,
    name: "my-project",
    html_url: "https://github.com/u/my-project",
    description: "A cool project",
    language: "TypeScript",
    stargazers_count: 0,
    forks_count: 0,
    updated_at: new Date().toISOString(), // 최근 → recencyFactor 1
    fork: false,
    topics: [],
    ...overrides,
  };
}

describe("computeShallowScore", () => {
  it("최근 + 짧은 description 만 있는 기본 repo 는 recency(15)+description(5)=20", () => {
    // "A cool project"(14자) → round((0.3 + 0.7*14/60)*10) = 5
    const { score, breakdown } = computeShallowScore(makeRepo());
    expect(score).toBe(20);
    expect(breakdown.recencyWeighted).toBe(15);
    expect(breakdown.descriptionWeighted).toBe(5);
    expect(breakdown.topicsBonus).toBe(0);
    expect(breakdown.deploymentBonus).toBe(0);
    expect(breakdown.archivedPenalty).toBe(0);
  });

  it("description 은 길이에 따라 연속(0~10)으로 가산된다", () => {
    const none = computeShallowScore(makeRepo({ description: null }));
    expect(none.breakdown.descriptionWeighted).toBe(0);

    // 60자 이상 충실한 설명 → 만점 10
    const full = computeShallowScore(
      makeRepo({ description: "A".repeat(80) }),
    );
    expect(full.breakdown.descriptionWeighted).toBe(10);
  });

  it("topics 가 있으면 +5 가산", () => {
    const { score, breakdown } = computeShallowScore(makeRepo({ topics: ["web"] }));
    expect(breakdown.topicsBonus).toBe(5);
    expect(score).toBe(25); // 15 + 5 + 5
  });

  it("homepage/Pages 가 있으면 배포 가산 +10", () => {
    const withHomepage = computeShallowScore(makeRepo({ homepage: "https://demo.app" }));
    expect(withHomepage.breakdown.deploymentBonus).toBe(10);
    expect(withHomepage.score).toBe(30); // 15 + 5 + 10

    const withPages = computeShallowScore(makeRepo({ has_pages: true }));
    expect(withPages.breakdown.deploymentBonus).toBe(10);
  });

  it("archived/disabled repo 는 -25 감점", () => {
    const archived = computeShallowScore(makeRepo({ archived: true }));
    expect(archived.breakdown.archivedPenalty).toBe(-25);
    expect(archived.score).toBe(0); // 15 + 5 - 25 → clamp 0
  });

  it("최근성은 updated_at 과 pushed_at 중 더 최근 값을 쓴다", () => {
    // updated_at 은 오래됐지만 pushed_at 이 최근이면 최근성 점수가 살아있어야 한다.
    const { breakdown } = computeShallowScore(
      makeRepo({
        updated_at: "2000-01-01T00:00:00Z",
        pushed_at: new Date().toISOString(),
      }),
    );
    expect(breakdown.recencyWeighted).toBe(15);
  });

  it("description 없는 fork 는 -10, description 있는 fork 는 -5 감점", () => {
    const noDesc = computeShallowScore(makeRepo({ fork: true, description: null }));
    expect(noDesc.breakdown.forkPenalty).toBe(-10);
    expect(noDesc.score).toBe(5); // 15 + 0 - 10

    const withDesc = computeShallowScore(makeRepo({ fork: true }));
    expect(withDesc.breakdown.forkPenalty).toBe(-5);
    expect(withDesc.score).toBe(15); // 15 + 5 - 5
  });

  it("튜토리얼/클론 패턴 이름은 -15 감점", () => {
    const { breakdown, score } = computeShallowScore(makeRepo({ name: "vue-tutorial" }));
    expect(breakdown.tutorialPenalty).toBe(-15);
    expect(score).toBe(5); // 15 + 5 - 15 → clamp 0 아님 (5)
  });

  it("점수는 0~100 으로 clamp 된다 (음수 합산 → 0)", () => {
    const { score } = computeShallowScore(
      makeRepo({
        updated_at: "2000-01-01T00:00:00Z",
        description: null,
        fork: true,
        name: "todo-app-clone",
        size: 5,
      }),
    );
    expect(score).toBe(0);
  });

  it("star 가 많으면 activityWeighted 가 증가한다 (0~8)", () => {
    const { breakdown } = computeShallowScore(makeRepo({ stargazers_count: 100 }));
    expect(breakdown.activityWeighted).toBeGreaterThan(0);
    expect(breakdown.activityWeighted).toBeLessThanOrEqual(8);
  });
});

describe("refineScoreWithDeepData", () => {
  function makeBase(): ScoredRepo {
    const repo = makeRepo();
    const { score, breakdown } = computeShallowScore(repo);
    return {
      ...repo,
      score,
      legacyScore: 0,
      scoreBreakdown: breakdown,
      hasReadme: false,
      hasStructure: false,
    };
  }

  it("README + 충분한 구조(엔트리>=3)면 readme15/structure20 가산", () => {
    const refined = refineScoreWithDeepData(makeBase(), { hasReadme: true, rootEntryCount: 5 });
    expect(refined.scoreBreakdown.readmeWeighted).toBe(15);
    expect(refined.scoreBreakdown.structureWeighted).toBe(20);
    expect(refined.hasStructure).toBe(true);
    expect(refined.score).toBe(55); // recency 15 + desc 5 + readme 15 + structure 20
  });

  it("루트 엔트리가 1~2개면 부분 구조 점수(10), 0개면 0", () => {
    const partial = refineScoreWithDeepData(makeBase(), { hasReadme: false, rootEntryCount: 1 });
    expect(partial.scoreBreakdown.structureWeighted).toBe(10);
    expect(partial.hasStructure).toBe(false);

    const empty = refineScoreWithDeepData(makeBase(), { hasReadme: false, rootEntryCount: 0 });
    expect(empty.scoreBreakdown.structureWeighted).toBe(0);
  });
});

describe("rankRepresentativeRepos", () => {
  it("점수 내림차순으로 정렬하고 limit 만큼 자른다", () => {
    const repos = [
      makeRepo({ id: 1, name: "a", topics: ["x"] }), // 25
      makeRepo({ id: 2, name: "b", fork: true, description: null }), // 5
      makeRepo({ id: 3, name: "c" }), // 20
    ];
    const ranked = rankRepresentativeRepos(repos, 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.score).toBeGreaterThanOrEqual(ranked[1]!.score);
    expect(ranked[0]!.name).toBe("a");
  });
});

describe("getLanguageDistribution / getTopLanguage", () => {
  it("언어 빈도를 내림차순으로 집계한다", () => {
    const repos = [
      makeRepo({ id: 1, language: "TypeScript" }),
      makeRepo({ id: 2, language: "TypeScript" }),
      makeRepo({ id: 3, language: "Python" }),
      makeRepo({ id: 4, language: null }),
    ];
    const dist = getLanguageDistribution(repos);
    expect(dist[0]).toEqual({ language: "TypeScript", count: 2 });
    expect(dist).toContainEqual({ language: "Python", count: 1 });
    expect(getTopLanguage(repos)).toBe("TypeScript");
  });

  it("언어가 전혀 없으면 Unknown", () => {
    expect(getTopLanguage([makeRepo({ language: null })])).toBe("Unknown");
  });
});
