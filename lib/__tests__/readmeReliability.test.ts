import { describe, expect, it } from "vitest";

import { evaluateReadmeReliability } from "@/lib/readmeReliability";

describe("evaluateReadmeReliability", () => {
  it("README 가 없으면 missing", () => {
    const result = evaluateReadmeReliability(null, null);
    expect(result.level).toBe("missing");
    expect(result.score).toBe(0);
  });

  it("빈 문자열도 missing", () => {
    expect(evaluateReadmeReliability("   ", null).level).toBe("missing");
  });

  it("너무 짧고 키워드 없는 README 는 low", () => {
    const result = evaluateReadmeReliability("hi", null);
    expect(result.level).toBe("low");
    expect(result.reasons.join(" ")).toContain("짧");
  });

  it("목적/기능/실행/기술스택을 모두 갖춘 긴 README 는 high", () => {
    const readme =
      `# 내 프로젝트\n프로젝트 목적: 학습용 대시보드입니다.\n주요 기능: 검색, 필터, 차트.\n설치 방법: pnpm install 후 pnpm dev.\n기술 스택: Next.js, TypeScript.\n` +
      "추가 설명 ".repeat(80);
    const result = evaluateReadmeReliability(readme, null);
    expect(result.level).toBe("high");
    expect(result.score).toBeGreaterThanOrEqual(6);
  });

  it("구조/커밋과 일치하면 가산점이 붙는다", () => {
    const readme =
      `프로젝트 목적: dashboard 프로젝트입니다.\n주요 기능: search, filter, chart components.\n설치: pnpm install.\n기술 스택: next, react.\n` +
      "dashboard search filter chart components ".repeat(20);
    const deep = {
      commits: [
        { sha: "1", message: "feat: add search filter", authorDate: "2025-05-01T00:00:00Z" },
        { sha: "2", message: "feat: chart components dashboard", authorDate: "2025-05-02T00:00:00Z" },
      ],
      rootTree: [
        { path: "components", type: "tree" as const },
        { path: "dashboard", type: "tree" as const },
      ],
    };
    const withDeep = evaluateReadmeReliability(readme, deep);
    expect(withDeep.reasons.join(" ")).toContain("일치");
  });
});
