import { describe, expect, it } from "vitest";

import {
  buildRepoReportInputs,
  buildUserReportInput,
  deterministicSeed,
  stableStringify,
  tryParseJson,
} from "@/lib/llm";
import type { ActivityPattern, AnalyzedRepo, DomainScores } from "@/lib/types";

describe("stableStringify", () => {
  it("객체 key 를 알파벳 순으로 정렬해 직렬화한다", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("중첩 객체/배열에서도 key 순서가 결정적이다", () => {
    const a = stableStringify({ z: { y: 1, x: 2 }, arr: [3, 1, 2] });
    const b = stableStringify({ arr: [3, 1, 2], z: { x: 2, y: 1 } });
    expect(a).toBe(b);
  });

  it("배열 순서는 보존한다", () => {
    expect(stableStringify([3, 1, 2])).toBe("[3,1,2]");
  });
});

describe("deterministicSeed", () => {
  it("같은 입력+salt 는 항상 같은 seed", () => {
    expect(deterministicSeed("payload", "salt")).toBe(deterministicSeed("payload", "salt"));
  });

  it("salt 가 다르면 seed 가 달라진다", () => {
    expect(deterministicSeed("payload", "a")).not.toBe(deterministicSeed("payload", "b"));
  });

  it("32-bit 정수 범위를 유지한다", () => {
    const seed = deterministicSeed("some long payload string", "v1");
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(-(2 ** 31));
    expect(seed).toBeLessThanOrEqual(2 ** 31 - 1);
  });
});

describe("tryParseJson", () => {
  it("정상 JSON 을 파싱한다", () => {
    expect(tryParseJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
  });

  it("```json 코드블록을 벗겨 파싱한다", () => {
    const text = "```json\n{\"a\":1}\n```";
    expect(tryParseJson<{ a: number }>(text)).toEqual({ a: 1 });
  });

  it("앞뒤 잡담이 있어도 첫 { ~ 마지막 } 를 추출한다", () => {
    const text = 'Here is the JSON:\n{"a":1, "b":2}\nThanks!';
    expect(tryParseJson<{ a: number; b: number }>(text)).toEqual({ a: 1, b: 2 });
  });

  it("파싱 불가/ null 은 null 을 반환한다", () => {
    expect(tryParseJson("not json at all")).toBeNull();
    expect(tryParseJson(null)).toBeNull();
  });
});

describe("buildUserReportInput / buildRepoReportInputs", () => {
  const domainScores: DomainScores = {
    frontend: 70,
    backend: 40,
    data_ml: 10,
    mobile: 0,
    devops: 5,
    collaboration: 20,
  };
  const activity: ActivityPattern = {
    night_ratio: 0.5,
    morning_ratio: 0.2,
    afternoon_ratio: 0.3,
    weekend_ratio: 0.3,
    consistency_score: 0.6,
    commit_sample_size: 12,
    activity_tags: [],
    timezone: "Asia/Seoul",
  };

  function makeAnalyzedRepo(name: string): AnalyzedRepo {
    return {
      id: Math.random(),
      name,
      html_url: `https://github.com/u/${name}`,
      description: "desc",
      language: "TypeScript",
      stargazers_count: 0,
      forks_count: 0,
      updated_at: new Date().toISOString(),
      fork: false,
      topics: [],
      score: 50,
      legacyScore: 0,
      scoreBreakdown: {} as AnalyzedRepo["scoreBreakdown"],
      hasReadme: true,
      hasStructure: true,
      readmeReliability: { level: "medium", score: 3, reasons: [] },
      techStack: ["Next.js", "React", "Tailwind CSS"],
      structureSummary: Array.from({ length: 12 }, (_, i) => `dir-${i}`),
      recentCommitMessages: Array.from({ length: 10 }, (_, i) => `commit-${i}`),
      inferenceNotes: ["프론트엔드 웹앱으로 추정"],
      analysisConfidence: "medium",
    };
  }

  it("top_languages 는 최대 5개로 제한한다", () => {
    const input = buildUserReportInput({
      username: "u",
      scope: "공개 저장소",
      publicRepos: 10,
      topLanguages: ["TS", "JS", "Py", "Go", "Rust", "C++"],
      domainScores,
      activity,
      topTags: ["t1"],
      selectedRepos: [makeAnalyzedRepo("a")],
    });
    expect(input.top_languages).toHaveLength(5);
    expect(input.repo_count).toBe(10);
  });

  it("repo 입력은 structure 8개 / commit 6개로 잘라낸다", () => {
    const [report] = buildRepoReportInputs([makeAnalyzedRepo("a")]);
    expect(report!.structure_summary).toHaveLength(8);
    expect(report!.recent_commits).toHaveLength(6);
    expect(report!.readme_reliability).toBe("medium");
  });
});
