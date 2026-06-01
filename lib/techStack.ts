// 기술 스택 추출
// - README 본문은 보조 신호로만 사용하고, 우선순위는 설정 파일과 디렉토리 구조에 둔다.
// - 각 신호별로 가중치(weight)를 매겨 누적 후 임계값을 넘긴 스택만 채택한다.
// - 결과는 repo 단위 stack 배열과 사용자 전체 distribution 으로 집계 가능.

import type { DeepRepoData, GitHubRepo, TreeEntry } from "./types";

type StackSignal = { stack: string; weight: number };

function safeJsonParse<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// package.json 파싱 → 의존성 기반 스택 추론
function fromPackageJson(text: string | null): StackSignal[] {
  type Pkg = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  };
  const pkg = safeJsonParse<Pkg>(text);
  if (!pkg) return [];

  const allDeps = new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);

  const mapping: Array<{ dep: string | RegExp; stack: string; weight?: number }> = [
    { dep: "next", stack: "Next.js", weight: 4 },
    { dep: "react", stack: "React", weight: 3 },
    { dep: "react-dom", stack: "React" },
    { dep: "react-native", stack: "React Native", weight: 4 },
    { dep: "vue", stack: "Vue", weight: 3 },
    { dep: "nuxt", stack: "Nuxt" },
    { dep: "svelte", stack: "Svelte" },
    { dep: "@angular/core", stack: "Angular" },
    { dep: "typescript", stack: "TypeScript", weight: 2 },
    { dep: "tailwindcss", stack: "Tailwind CSS" },
    { dep: "@emotion/react", stack: "Emotion" },
    { dep: "styled-components", stack: "Styled Components" },
    { dep: "zustand", stack: "Zustand" },
    { dep: "redux", stack: "Redux" },
    { dep: "@reduxjs/toolkit", stack: "Redux Toolkit" },
    { dep: "recoil", stack: "Recoil" },
    { dep: "@tanstack/react-query", stack: "React Query" },
    { dep: "swr", stack: "SWR" },
    { dep: "express", stack: "Express", weight: 3 },
    { dep: "koa", stack: "Koa" },
    { dep: "@nestjs/core", stack: "NestJS", weight: 3 },
    { dep: "fastify", stack: "Fastify" },
    { dep: "prisma", stack: "Prisma" },
    { dep: "typeorm", stack: "TypeORM" },
    { dep: "mongoose", stack: "Mongoose" },
    { dep: "sequelize", stack: "Sequelize" },
    { dep: "jest", stack: "Jest" },
    { dep: "vitest", stack: "Vitest" },
    { dep: "playwright", stack: "Playwright" },
    { dep: "cypress", stack: "Cypress" },
    { dep: "electron", stack: "Electron" },
    { dep: "expo", stack: "Expo" },
    { dep: "three", stack: "Three.js" },
  ];

  const out: StackSignal[] = [];
  for (const { dep, stack, weight = 3 } of mapping) {
    if (typeof dep === "string") {
      if (allDeps.has(dep)) out.push({ stack, weight });
    } else if (Array.from(allDeps).some((d) => dep.test(d))) {
      out.push({ stack, weight });
    }
  }
  return out;
}

// requirements.txt / pyproject.toml 기반 추론
function fromPython(requirements: string | null, pyproject: string | null): StackSignal[] {
  const combined = `${requirements ?? ""}\n${pyproject ?? ""}`.toLowerCase();
  if (!combined.trim()) return [];

  const mapping: Array<{ key: string; stack: string; weight?: number }> = [
    { key: "django", stack: "Django", weight: 3 },
    { key: "fastapi", stack: "FastAPI", weight: 3 },
    { key: "flask", stack: "Flask", weight: 3 },
    { key: "uvicorn", stack: "Uvicorn" },
    { key: "pandas", stack: "pandas", weight: 3 },
    { key: "numpy", stack: "NumPy" },
    { key: "scikit-learn", stack: "scikit-learn", weight: 3 },
    { key: "sklearn", stack: "scikit-learn", weight: 3 },
    { key: "tensorflow", stack: "TensorFlow", weight: 3 },
    { key: "torch", stack: "PyTorch", weight: 3 },
    { key: "transformers", stack: "Transformers" },
    { key: "langchain", stack: "LangChain" },
    { key: "openai", stack: "OpenAI SDK" },
    { key: "pytest", stack: "pytest" },
    { key: "celery", stack: "Celery" },
    { key: "sqlalchemy", stack: "SQLAlchemy" },
  ];

  return mapping
    .filter(({ key }) => combined.includes(key))
    .map(({ stack, weight = 3 }) => ({ stack, weight }));
}

// JVM (Gradle/Maven) 기반
function fromJvm(gradle: string | null, pom: string | null): StackSignal[] {
  const combined = `${gradle ?? ""}\n${pom ?? ""}`.toLowerCase();
  if (!combined.trim()) return [];

  const out: StackSignal[] = [{ stack: "Java", weight: 2 }];
  if (combined.includes("spring-boot") || combined.includes("springframework.boot")) {
    out.push({ stack: "Spring Boot", weight: 4 });
  }
  if (combined.includes("springframework")) out.push({ stack: "Spring", weight: 2 });
  if (combined.includes("kotlin")) out.push({ stack: "Kotlin", weight: 3 });
  if (combined.includes("scala")) out.push({ stack: "Scala", weight: 3 });
  return out;
}

function fromDart(pubspec: string | null): StackSignal[] {
  if (!pubspec) return [];
  return [{ stack: "Flutter", weight: 4 }];
}

function fromDocker(dockerfile: string | null): StackSignal[] {
  if (!dockerfile) return [];
  return [{ stack: "Docker", weight: 3 }];
}

// 디렉토리 구조 기반 신호
function fromTree(tree: TreeEntry[]): StackSignal[] {
  const paths = tree.map((e) => e.path.toLowerCase());
  const out: StackSignal[] = [];

  const has = (p: string) => paths.includes(p);
  const hasAny = (ps: string[]) => ps.some(has);

  if (hasAny([".github"])) out.push({ stack: "GitHub Actions", weight: 2 });
  if (hasAny(["dockerfile", ".dockerignore"])) out.push({ stack: "Docker", weight: 2 });
  if (hasAny(["pages", "app", "components", "src"])) {
    // Frontend 가능성 신호: stack 자체로 추가하기엔 약하므로 별도 도메인 채점에서 다룸
  }
  if (hasAny(["notebooks"])) out.push({ stack: "Jupyter", weight: 2 });
  if (paths.some((p) => p.endsWith(".ipynb"))) out.push({ stack: "Jupyter", weight: 2 });
  if (hasAny(["android", "ios"])) out.push({ stack: "Mobile Native", weight: 2 });
  return out;
}

// 언어 분포 기반 (HTTP languages 응답 byte 수)
function fromLanguages(languages: Record<string, number>): StackSignal[] {
  return Object.keys(languages).map((lang) => ({ stack: lang, weight: 1 }));
}

// 단일 repo 기술 스택
export function extractRepoTechStack(repo: GitHubRepo, deep: DeepRepoData | null): string[] {
  const accumulator = new Map<string, number>();
  const add = (sigs: StackSignal[]) => {
    for (const { stack, weight } of sigs) {
      accumulator.set(stack, (accumulator.get(stack) ?? 0) + weight);
    }
  };

  if (repo.language) accumulator.set(repo.language, (accumulator.get(repo.language) ?? 0) + 2);

  if (deep) {
    add(fromPackageJson(deep.configFiles["package.json"]));
    add(fromPython(deep.configFiles["requirements.txt"], deep.configFiles["pyproject.toml"]));
    add(fromJvm(deep.configFiles["build.gradle"], deep.configFiles["pom.xml"]));
    add(fromDart(deep.configFiles["pubspec.yaml"]));
    add(fromDocker(deep.configFiles["Dockerfile"]));
    add(fromTree(deep.rootTree));
    add(fromLanguages(deep.languages));
  }

  if (repo.topics) {
    for (const t of repo.topics) {
      accumulator.set(t, (accumulator.get(t) ?? 0) + 1);
    }
  }

  const TECH_THRESHOLD = 2;
  return Array.from(accumulator.entries())
    .filter(([, weight]) => weight >= TECH_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([stack]) => stack);
}

// === 기술 스택 범주화 ===
// 뱃지가 언어/프레임워크/ML/도구 등으로 섞여 한 줄에 나열되면 읽기 어렵다.
// 표시 단계에서 범주별로 묶어 가독성을 높인다. (점수/추출 로직과는 무관)

export type TechCategory =
  | "언어"
  | "프론트엔드"
  | "백엔드"
  | "데이터·ML"
  | "데이터베이스"
  | "모바일"
  | "테스트"
  | "인프라·도구"
  | "기타";

const CATEGORY_ORDER: TechCategory[] = [
  "언어",
  "프론트엔드",
  "백엔드",
  "데이터·ML",
  "데이터베이스",
  "모바일",
  "테스트",
  "인프라·도구",
  "기타",
];

// extractRepoTechStack 가 만들어내는 정규화된 스택 이름 → 범주 매핑.
const STACK_CATEGORY: Record<string, TechCategory> = {
  // 언어
  TypeScript: "언어",
  Java: "언어",
  Kotlin: "언어",
  Scala: "언어",
  // 프론트엔드
  "Next.js": "프론트엔드",
  React: "프론트엔드",
  Vue: "프론트엔드",
  Nuxt: "프론트엔드",
  Svelte: "프론트엔드",
  Angular: "프론트엔드",
  "Tailwind CSS": "프론트엔드",
  Emotion: "프론트엔드",
  "Styled Components": "프론트엔드",
  Zustand: "프론트엔드",
  Redux: "프론트엔드",
  "Redux Toolkit": "프론트엔드",
  Recoil: "프론트엔드",
  "React Query": "프론트엔드",
  SWR: "프론트엔드",
  "Three.js": "프론트엔드",
  // 백엔드
  Express: "백엔드",
  Koa: "백엔드",
  NestJS: "백엔드",
  Fastify: "백엔드",
  Django: "백엔드",
  FastAPI: "백엔드",
  Flask: "백엔드",
  Uvicorn: "백엔드",
  "Spring Boot": "백엔드",
  Spring: "백엔드",
  Celery: "백엔드",
  // 데이터·ML
  pandas: "데이터·ML",
  NumPy: "데이터·ML",
  "scikit-learn": "데이터·ML",
  TensorFlow: "데이터·ML",
  PyTorch: "데이터·ML",
  Transformers: "데이터·ML",
  LangChain: "데이터·ML",
  "OpenAI SDK": "데이터·ML",
  Jupyter: "데이터·ML",
  // 데이터베이스
  Prisma: "데이터베이스",
  TypeORM: "데이터베이스",
  Mongoose: "데이터베이스",
  Sequelize: "데이터베이스",
  SQLAlchemy: "데이터베이스",
  // 모바일
  "React Native": "모바일",
  Expo: "모바일",
  Flutter: "모바일",
  "Mobile Native": "모바일",
  // 테스트
  Jest: "테스트",
  Vitest: "테스트",
  Playwright: "테스트",
  Cypress: "테스트",
  pytest: "테스트",
  // 인프라·도구
  Docker: "인프라·도구",
  "GitHub Actions": "인프라·도구",
  Electron: "인프라·도구",
};

// languages API / repo.language 로 들어올 수 있는 언어들 (매핑에 없으면 "언어"로 분류).
const LANGUAGE_NAMES = new Set<string>([
  "JavaScript",
  "Python",
  "Go",
  "Rust",
  "Ruby",
  "PHP",
  "C",
  "C++",
  "C#",
  "Swift",
  "Dart",
  "Objective-C",
  "HTML",
  "CSS",
  "SCSS",
  "Shell",
  "PowerShell",
  "Lua",
  "R",
  "MATLAB",
  "Vimscript",
  "Dockerfile",
]);

export function categorizeTech(stack: string): TechCategory {
  return STACK_CATEGORY[stack] ?? (LANGUAGE_NAMES.has(stack) ? "언어" : "기타");
}

// 스택 목록을 범주별로 묶는다. 입력 순서(weight 정렬)는 각 범주 안에서 유지된다.
export function groupTechStack(stacks: string[]): Array<{ category: TechCategory; items: string[] }> {
  const buckets = new Map<TechCategory, string[]>();
  for (const stack of stacks) {
    const category = categorizeTech(stack);
    const list = buckets.get(category);
    if (list) list.push(stack);
    else buckets.set(category, [stack]);
  }
  return CATEGORY_ORDER.filter((category) => buckets.has(category)).map((category) => ({
    category,
    items: buckets.get(category) as string[],
  }));
}

// 사용자 전체 기술 스택 분포 집계
export function aggregateTechStackDistribution(
  repoStacks: string[][],
): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const stacks of repoStacks) {
    const unique = new Set(stacks);
    for (const stack of unique) {
      counts.set(stack, (counts.get(stack) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}
