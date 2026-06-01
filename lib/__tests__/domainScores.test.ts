import { describe, expect, it } from "vitest";

import {
  aggregateDomainScores,
  combineDomainSignals,
  scoreRepoForDomains,
} from "@/lib/domainScores";
import type { GitHubRepo } from "@/lib/scoring";
import type { DeepRepoData, DomainScores, ReadmeReliability } from "@/lib/types";

const ZERO: DomainScores = {
  frontend: 0,
  backend: 0,
  data_ml: 0,
  mobile: 0,
  devops: 0,
  collaboration: 0,
};

function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id: 1,
    name: "repo",
    html_url: "https://github.com/u/repo",
    description: null,
    language: null,
    stargazers_count: 0,
    forks_count: 0,
    updated_at: new Date().toISOString(),
    fork: false,
    topics: [],
    ...overrides,
  };
}

function makeDeep(tree: string[]): DeepRepoData {
  return {
    readmeText: null,
    rootTree: tree.map((path) => ({ path, type: "tree" as const })),
    languages: {},
    commits: [],
    configFiles: {},
  };
}

const lowReliability: ReadmeReliability = { level: "low", score: 0, reasons: [] };

describe("aggregateDomainScores", () => {
  it("빈 입력은 모두 0", () => {
    expect(aggregateDomainScores([])).toEqual(ZERO);
  });

  it("log scale 로 정규화한다 (raw 5 → 65)", () => {
    const result = aggregateDomainScores([{ ...ZERO, frontend: 5 }]);
    // round(25 * log2(1 + 5)) = round(64.62) = 65
    expect(result.frontend).toBe(65);
    expect(result.backend).toBe(0);
  });

  it("raw 가 커도 100 을 넘지 않는다", () => {
    const result = aggregateDomainScores([{ ...ZERO, backend: 1000 }]);
    expect(result.backend).toBeLessThanOrEqual(100);
  });
});

describe("scoreRepoForDomains", () => {
  it("React/Next + components 디렉토리는 frontend 신호를 누적한다", () => {
    const out = scoreRepoForDomains(
      makeRepo(),
      ["React", "Next.js"],
      makeDeep(["components"]),
      lowReliability,
    );
    expect(out.frontend).toBe(4); // stack(+3) + components(+1)
    expect(out.backend).toBe(0);
  });

  it("fork repo 는 도메인 점수를 0.4 배로 약화한다", () => {
    const base = scoreRepoForDomains(makeRepo(), ["React"], makeDeep([]), lowReliability);
    const forked = scoreRepoForDomains(
      makeRepo({ fork: true }),
      ["React"],
      makeDeep([]),
      lowReliability,
    );
    expect(forked.frontend).toBeCloseTo(base.frontend * 0.4, 5);
  });
});

describe("combineDomainSignals", () => {
  it("shallow 언어 신호와 대표 repo deep 신호를 합산해 정규화한다", () => {
    const shallow = [makeRepo({ language: "Python" }), makeRepo({ language: "Python" })];
    const result = combineDomainSignals(shallow, [{ ...ZERO, data_ml: 3 }]);
    expect(result.data_ml).toBeGreaterThan(0);
    expect(result.data_ml).toBeLessThanOrEqual(100);
  });
});
