import { describe, expect, it } from "vitest";

import {
  aggregateTechStackDistribution,
  categorizeTech,
  extractRepoTechStack,
  groupTechStack,
} from "@/lib/techStack";
import type { GitHubRepo } from "@/lib/scoring";
import type { DeepRepoData } from "@/lib/types";

function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id: 1,
    name: "repo",
    html_url: "https://github.com/u/repo",
    description: null,
    language: "TypeScript",
    stargazers_count: 0,
    forks_count: 0,
    updated_at: new Date().toISOString(),
    fork: false,
    topics: [],
    ...overrides,
  };
}

function makeDeep(overrides: Partial<DeepRepoData> = {}): DeepRepoData {
  return {
    readmeText: null,
    rootTree: [],
    languages: {},
    commits: [],
    configFiles: {},
    ...overrides,
  };
}

describe("extractRepoTechStack", () => {
  it("package.json 의존성에서 프레임워크를 추출한다", () => {
    const deep = makeDeep({
      configFiles: {
        "package.json": JSON.stringify({
          dependencies: { next: "14", react: "18", tailwindcss: "4" },
          devDependencies: { typescript: "5" },
        }),
      },
    });
    const stack = extractRepoTechStack(makeRepo(), deep);
    expect(stack).toContain("Next.js");
    expect(stack).toContain("React");
    expect(stack).toContain("TypeScript");
    expect(stack).toContain("Tailwind CSS");
  });

  it("requirements.txt 에서 Python ML 스택을 추출한다", () => {
    const deep = makeDeep({
      configFiles: { "requirements.txt": "torch==2.0\npandas\nscikit-learn" },
    });
    const stack = extractRepoTechStack(makeRepo({ language: "Python" }), deep);
    expect(stack).toContain("PyTorch");
    expect(stack).toContain("pandas");
    expect(stack).toContain("scikit-learn");
  });

  it("deep 데이터가 없으면 언어만으로 빈약한 결과를 낸다", () => {
    const stack = extractRepoTechStack(makeRepo({ language: "Go" }), null);
    expect(stack).toContain("Go"); // language 가중치 +2 → 임계값 통과
  });

  it("잘못된 package.json 은 무시하고 깨지지 않는다", () => {
    const deep = makeDeep({ configFiles: { "package.json": "{not json" } });
    expect(() => extractRepoTechStack(makeRepo(), deep)).not.toThrow();
  });
});

describe("groupTechStack", () => {
  it("스택을 범주별로 묶고 고정된 범주 순서를 따른다", () => {
    const groups = groupTechStack([
      "PyTorch",
      "Next.js",
      "TypeScript",
      "Docker",
      "Transformers",
      "Vitest",
    ]);
    const order = groups.map((g) => g.category);
    // CATEGORY_ORDER: 언어 → 프론트엔드 → ... → 데이터·ML → ... → 테스트 → 인프라·도구
    expect(order).toEqual(["언어", "프론트엔드", "데이터·ML", "테스트", "인프라·도구"]);
    const ml = groups.find((g) => g.category === "데이터·ML");
    expect(ml?.items).toEqual(["PyTorch", "Transformers"]);
  });

  it("매핑에 없는 언어는 '언어', 그 외 미지의 값은 '기타'로 분류한다", () => {
    expect(categorizeTech("Go")).toBe("언어");
    expect(categorizeTech("PyTorch")).toBe("데이터·ML");
    expect(categorizeTech("some-random-topic")).toBe("기타");
  });
});

describe("aggregateTechStackDistribution", () => {
  it("repo 별 스택을 빈도순으로 집계한다 (repo 내 중복은 1회)", () => {
    const dist = aggregateTechStackDistribution([
      ["React", "TypeScript", "React"],
      ["React"],
      ["Python"],
    ]);
    expect(dist[0]).toEqual({ name: "React", count: 2 });
    expect(dist).toContainEqual({ name: "TypeScript", count: 1 });
    expect(dist).toContainEqual({ name: "Python", count: 1 });
  });
});
