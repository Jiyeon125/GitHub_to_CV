// README 신뢰도 평가
// - 명세서 점수 기준을 가능한 그대로 옮긴 규칙 기반 평가기.
// - README 내용만 보는 것이 아니라 구조와 commit 메시지를 교차 검증한다.
// - 결과는 high / medium / low / missing 의 4단계.

import type { DeepRepoData, ReadmeReliability, ReadmeReliabilityLevel } from "./types";

const TEMPLATE_PHRASES = [
  // create-react-app, next-app, vue-cli 등에서 기본 생성되는 문구들
  "this project was bootstrapped with",
  "create-react-app",
  "available scripts",
  "in the project directory, you can run",
  "see the section about deployment",
  "you will also see any lint errors",
  "this is a next.js project bootstrapped with",
  "getting started with create-react-app",
];

const PURPOSE_KEYWORDS = [
  // 한국어/영어 모두 커버
  "프로젝트",
  "목적",
  "소개",
  "introduction",
  "overview",
  "about",
  "purpose",
  "motivation",
];

const FEATURE_KEYWORDS = [
  "기능",
  "feature",
  "features",
  "주요 기능",
  "what it does",
  "what you can",
];

const USAGE_KEYWORDS = [
  "실행",
  "사용법",
  "사용 방법",
  "설치",
  "getting started",
  "installation",
  "install",
  "usage",
  "how to run",
  "quick start",
  "run the",
  "npm install",
  "pnpm install",
  "yarn install",
  "pip install",
  "docker run",
];

const TECH_KEYWORDS = [
  "기술 스택",
  "tech stack",
  "stack",
  "built with",
  "technologies",
  "사용 기술",
  "tools",
];

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[`*_>#\[\]\(\)\{\}\-\!\?\,\.\;\:\/\\]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

function levelFromScore(score: number): ReadmeReliabilityLevel {
  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}

export function evaluateReadmeReliability(
  readmeText: string | null,
  deep: Pick<DeepRepoData, "commits" | "rootTree"> | null,
): ReadmeReliability {
  if (!readmeText || readmeText.trim().length === 0) {
    return {
      level: "missing",
      score: 0,
      reasons: ["README가 존재하지 않습니다."],
    };
  }

  const lowered = readmeText.toLowerCase();
  const reasons: string[] = [];
  let score = 0;

  // === 가점 ===
  // README 길이가 충분함: 500자 이상이면 +2
  if (readmeText.length >= 500) {
    score += 2;
    reasons.push("README 길이가 충분합니다.");
  } else if (readmeText.length < 200) {
    score -= 2;
    reasons.push("README가 너무 짧습니다.");
  }

  if (includesAny(lowered, PURPOSE_KEYWORDS)) {
    score += 2;
    reasons.push("프로젝트 목적이 설명되어 있습니다.");
  }

  if (includesAny(lowered, FEATURE_KEYWORDS)) {
    score += 2;
    reasons.push("핵심 기능 설명이 포함되어 있습니다.");
  } else {
    score -= 2;
    reasons.push("기능 설명이 부족합니다.");
  }

  if (includesAny(lowered, USAGE_KEYWORDS)) {
    score += 1;
    reasons.push("실행 방법이 포함되어 있습니다.");
  }

  if (includesAny(lowered, TECH_KEYWORDS)) {
    score += 1;
    reasons.push("기술 스택이 명시되어 있습니다.");
  }

  // === 감점: 템플릿 문구 위주인지 ===
  const templateHits = TEMPLATE_PHRASES.filter((p) => lowered.includes(p)).length;
  if (templateHits >= 2) {
    score -= 2;
    reasons.push("템플릿 문구가 많이 포함되어 있습니다.");
  }

  // === 구조/commit 교차 검증 ===
  if (deep) {
    const treePaths = deep.rootTree.map((e) => e.path.toLowerCase());
    const commitText = deep.commits
      .map((c) => c.message)
      .join("\n")
      .toLowerCase();
    const readmeTokens = new Set(tokenize(readmeText));

    // README에 언급된 단어가 commit/tree 어디에도 안 나오면 일관성 의심
    const referenceTokens = new Set([
      ...tokenize(commitText),
      ...tokenize(treePaths.join(" ")),
    ]);

    if (readmeTokens.size > 10 && referenceTokens.size > 0) {
      const intersectionSize = Array.from(readmeTokens).filter((t) =>
        referenceTokens.has(t),
      ).length;
      const overlapRatio = intersectionSize / readmeTokens.size;

      if (overlapRatio >= 0.05) {
        score += 2;
        reasons.push("README가 구조/커밋 내용과 어느 정도 일치합니다.");
      } else if (overlapRatio < 0.01 && readmeText.length > 300) {
        score -= 3;
        reasons.push("README가 실제 구조/커밋과 거리가 큽니다.");
      }
    }
  }

  return {
    level: levelFromScore(score),
    score,
    reasons,
  };
}
