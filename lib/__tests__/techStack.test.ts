import { describe, expect, it } from "vitest";

import {
  aggregateTechStackDistribution,
  categorizeTech,
  extractRepoLanguages,
  extractRepoTechStack,
  groupTechStack,
  techStackWithoutLanguages,
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

  it("주 언어가 아니어도 byte 비중이 충분한 언어를 채택한다", () => {
    const deep = makeDeep({
      languages: { TypeScript: 7000, Python: 3000, CSS: 200 },
    });
    const stack = extractRepoTechStack(makeRepo({ language: "TypeScript" }), deep);
    expect(stack).toContain("TypeScript");
    expect(stack).toContain("Python"); // 30% → weight 2 → 임계값 통과
    expect(stack).not.toContain("CSS"); // 2% → weight 1 → 탈락
  });

  it("package.json DB 드라이버에서 DB 엔진을 추출한다", () => {
    const deep = makeDeep({
      configFiles: {
        "package.json": JSON.stringify({ dependencies: { pg: "8", ioredis: "5" } }),
      },
    });
    const stack = extractRepoTechStack(makeRepo(), deep);
    expect(stack).toContain("PostgreSQL");
    expect(stack).toContain("Redis");
  });

  it(".env 예시 키에서 DB/캐시 엔진을 추정한다 (값은 보지 않음)", () => {
    const deep = makeDeep({ envKeys: ["POSTGRES_HOST", "REDIS_URL", "DATABASE_URL"] });
    const stack = extractRepoTechStack(makeRepo(), deep);
    expect(stack).toContain("PostgreSQL");
    expect(stack).toContain("Redis");
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

describe("extractRepoLanguages", () => {
  it("byte 분포의 모든 언어를 비중과 함께 내림차순으로 반환한다 (임계값 없음)", () => {
    const deep = makeDeep({ languages: { TypeScript: 7000, Python: 2800, CSS: 200 } });
    const langs = extractRepoLanguages(makeRepo({ language: "TypeScript" }), deep);
    expect(langs.map((l) => l.name)).toEqual(["TypeScript", "Python", "CSS"]);
    expect(langs[0].share).toBeCloseTo(0.7, 5);
    expect(langs.some((l) => l.name === "CSS")).toBe(true); // 작아도 전부 포함
  });

  it("byte 분포가 없으면 주 언어만 100%로 반환한다", () => {
    const langs = extractRepoLanguages(makeRepo({ language: "Go" }), makeDeep());
    expect(langs).toEqual([{ name: "Go", share: 1 }]);
  });
});

describe("techStackWithoutLanguages", () => {
  it("순수 언어 항목만 제거하고 프레임워크/DB/도구는 남긴다", () => {
    const result = techStackWithoutLanguages(["TypeScript", "React", "Go", "PostgreSQL", "Docker"]);
    expect(result).toEqual(["React", "PostgreSQL", "Docker"]);
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
