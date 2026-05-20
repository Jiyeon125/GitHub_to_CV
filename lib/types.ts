// MVP에서 모듈 간 공유되는 데이터 모델
// PoC의 ScoredRepo는 lib/scoring.ts에 그대로 보존되어 있으며,
// 본 파일은 deep 분석 단계에서 다루는 확장 타입을 정의한다.

import type { GitHubRepo, ScoredRepo } from "./scoring";

export type { GitHubRepo, ScoredRepo };

export type RepoCommit = {
  sha: string;
  message: string;
  authorDate: string; // ISO timestamp
};

export type TreeEntry = {
  path: string;
  type: "blob" | "tree" | string;
};

// 2차 deep collection 결과: 대표 repo에 대해서만 수집
export type DeepRepoData = {
  readmeText: string | null;
  rootTree: TreeEntry[];
  languages: Record<string, number>;
  commits: RepoCommit[];
  configFiles: Record<string, string | null>; // package.json, requirements.txt 등의 원문 일부
};

export type ReadmeReliabilityLevel = "high" | "medium" | "low" | "missing";

export type ReadmeReliability = {
  level: ReadmeReliabilityLevel;
  score: number;
  reasons: string[]; // 가점/감점 사유
};

export type TechStack = string[];

export type DomainKey =
  | "frontend"
  | "backend"
  | "data_ml"
  | "mobile"
  | "devops"
  | "collaboration";

export type DomainScores = Record<DomainKey, number>;

export type ActivityPattern = {
  night_ratio: number;
  morning_ratio: number;
  weekend_ratio: number;
  consistency_score: number;
  commit_sample_size: number;
  activity_tags: string[];
};

// repo별 LLM 출력 스키마 (명세서 그대로)
export type LLMRepoReport = {
  repo_name: string;
  project_summary: string;
  core_features: string[];
  portfolio_sentence: string;
  resume_bullets: string[];
  interview_questions: string[];
  confidence: ReadmeReliabilityLevel;
};

// 사용자 전체 LLM 출력 스키마
export type LLMUserReport = {
  headline: string;
  summary: string;
  tags: Array<{ name: string; reason: string }>;
  warnings: string[];
};

// 최종 분석된 repo 단위
export type AnalyzedRepo = ScoredRepo & {
  readmeReliability: ReadmeReliability;
  techStack: TechStack;
  structureSummary: string[]; // 루트 디렉토리 요약
  recentCommitMessages: string[];
  inferenceNotes: string[]; // 규칙 기반 추론 메모
  analysisConfidence: ReadmeReliabilityLevel; // README + structure 종합
  llm?: LLMRepoReport | null;
};

// API 응답 페이로드
export type AnalyzeResponse = {
  username: string;
  profileUrl: string;
  publicRepos: number;
  selectedRepos: AnalyzedRepo[];
  topLanguage: string;
  languageDistribution: Array<{ language: string; count: number }>;
  techStackDistribution: Array<{ name: string; count: number }>;
  domainScores: DomainScores;
  activityPattern: ActivityPattern;
  topTagsCandidates: string[];
  warnings: string[];
  llm: LLMUserReport | null;
  llmEnabled: boolean;
  llmProvider: "openai" | "gemini" | "none";
  summary: string; // PoC 호환용 텍스트 요약
  generatedAt: string; // ISO
  cached: boolean;
};

export type AnalyzeOptions = {
  username: string;
  representativeCount: number; // 3~5
  useLlm: boolean;
};
