// 분야별 점수 계산
// - 6개 축: frontend / backend / data_ml / mobile / devops / collaboration
// - repo 단위로 raw score를 누적한 뒤, 사용자 전체 0~100 범위로 정규화한다.
// - 단순 합산 대신 log scale을 적용해 다중 repo 보유자가 100을 항상 찍지 않도록 한다.

import type {
  AnalyzedRepo,
  DeepRepoData,
  DomainKey,
  DomainScores,
  GitHubRepo,
  ReadmeReliability,
  TechStack,
  TreeEntry,
} from "./types";

const ZERO: DomainScores = {
  frontend: 0,
  backend: 0,
  data_ml: 0,
  mobile: 0,
  devops: 0,
  collaboration: 0,
};

function pathHas(tree: TreeEntry[], target: string): boolean {
  const lowered = tree.map((e) => e.path.toLowerCase());
  return lowered.includes(target);
}

function stackHasAny(stack: TechStack, names: string[]): boolean {
  const lowered = stack.map((s) => s.toLowerCase());
  return names.some((n) => lowered.includes(n.toLowerCase()));
}

// repo 단위 raw 점수 계산
export function scoreRepoForDomains(
  repo: GitHubRepo,
  stack: TechStack,
  deep: DeepRepoData | null,
  readmeReliability: ReadmeReliability,
): DomainScores {
  const out: DomainScores = { ...ZERO };
  const tree = deep?.rootTree ?? [];
  const commitText = deep?.commits.map((c) => c.message).join(" ").toLowerCase() ?? "";

  // Frontend
  if (stackHasAny(stack, ["React", "Next.js", "Vue", "Nuxt", "Svelte", "Angular", "Tailwind CSS"])) {
    out.frontend += 3;
  }
  if (pathHas(tree, "components") || pathHas(tree, "pages") || pathHas(tree, "app")) {
    out.frontend += 1;
  }
  if (stackHasAny(stack, ["TypeScript"]) && stackHasAny(stack, ["React", "Next.js", "Vue"])) {
    out.frontend += 1;
  }

  // Backend
  if (stackHasAny(stack, ["Express", "NestJS", "Fastify", "Koa", "FastAPI", "Django", "Flask", "Spring Boot", "Spring"])) {
    out.backend += 3;
  }
  if (pathHas(tree, "api") || pathHas(tree, "server") || pathHas(tree, "routes") || pathHas(tree, "controllers")) {
    out.backend += 1;
  }
  if (stackHasAny(stack, ["Prisma", "TypeORM", "SQLAlchemy", "Mongoose", "Sequelize"])) {
    out.backend += 1;
  }

  // Data/ML
  if (stackHasAny(stack, ["pandas", "NumPy", "scikit-learn", "PyTorch", "TensorFlow", "Transformers", "LangChain"])) {
    out.data_ml += 3;
  }
  if (stackHasAny(stack, ["Jupyter"])) {
    out.data_ml += 2;
  }
  if (pathHas(tree, "notebooks") || pathHas(tree, "data")) {
    out.data_ml += 1;
  }

  // Mobile
  if (stackHasAny(stack, ["Flutter", "React Native", "Expo", "Mobile Native"])) {
    out.mobile += 3;
  }
  if (pathHas(tree, "android") || pathHas(tree, "ios")) {
    out.mobile += 1;
  }

  // DevOps
  if (stackHasAny(stack, ["Docker", "GitHub Actions"])) {
    out.devops += 3;
  }
  if (pathHas(tree, "infra") || pathHas(tree, "terraform") || pathHas(tree, "deploy") || pathHas(tree, "k8s")) {
    out.devops += 1;
  }
  if (commitText.includes("ci") || commitText.includes("deploy") || commitText.includes("docker")) {
    out.devops += 0.5;
  }

  // Collaboration / Documentation
  if (readmeReliability.level === "high") out.collaboration += 2;
  else if (readmeReliability.level === "medium") out.collaboration += 1;
  if (pathHas(tree, "docs")) out.collaboration += 1;
  if (commitText.includes("docs:") || commitText.includes("readme")) out.collaboration += 0.5;
  if (repo.description && repo.description.trim().length > 20) out.collaboration += 0.5;

  // fork repo는 활동 점수의 반영 비중을 낮춘다
  if (repo.fork) {
    (Object.keys(out) as DomainKey[]).forEach((k) => {
      out[k] = out[k] * 0.4;
    });
  }

  return out;
}

// 사용자 전체로 합산 후 0~100 정규화
export function aggregateDomainScores(repoScores: DomainScores[]): DomainScores {
  if (repoScores.length === 0) return { ...ZERO };

  // 단순 합산
  const summed: DomainScores = { ...ZERO };
  for (const s of repoScores) {
    (Object.keys(summed) as DomainKey[]).forEach((k) => {
      summed[k] += s[k];
    });
  }

  // log scale 정규화: 점수 5 ≈ 60점, 점수 10 ≈ 80점, 점수 20+ ≈ 95점
  const normalized: DomainScores = { ...ZERO };
  (Object.keys(summed) as DomainKey[]).forEach((k) => {
    const raw = summed[k];
    if (raw <= 0) {
      normalized[k] = 0;
    } else {
      const value = Math.round(Math.min(100, 25 * Math.log2(1 + raw)));
      normalized[k] = value;
    }
  });

  return normalized;
}

// 분석된 repo 리스트로부터 한 번에 사용자 전체 점수 산출
export function computeUserDomainScores(repos: AnalyzedRepo[], deepMap: Map<number, DeepRepoData | null>): DomainScores {
  const perRepo = repos.map((repo) =>
    scoreRepoForDomains(repo, repo.techStack, deepMap.get(repo.id) ?? null, repo.readmeReliability),
  );
  return aggregateDomainScores(perRepo);
}

// === 전체 shallow repo 신호 ===
// 대표 repo 외 사용자의 다른 공개 repo도 도메인 점수에 영향을 주도록 한다.
// shallow 단계에서는 language 와 topic 만 알 수 있으므로 신호 강도를 약하게 부여한다.
const LANGUAGE_DOMAIN_HINT: Record<string, Partial<DomainScores>> = {
  // Frontend
  TypeScript: { frontend: 0.6 },
  JavaScript: { frontend: 0.5 },
  Vue: { frontend: 1 },
  Svelte: { frontend: 1 },
  HTML: { frontend: 0.4 },
  CSS: { frontend: 0.3 },
  // Backend
  Java: { backend: 0.7 },
  Kotlin: { backend: 0.7 },
  Go: { backend: 0.7 },
  Ruby: { backend: 0.6 },
  PHP: { backend: 0.5 },
  "C#": { backend: 0.6 },
  // Data / ML
  Python: { data_ml: 0.4, backend: 0.3 },
  R: { data_ml: 0.8 },
  Jupyter: { data_ml: 0.8 },
  "Jupyter Notebook": { data_ml: 0.8 },
  // Mobile
  Swift: { mobile: 1 },
  Dart: { mobile: 1 },
  "Objective-C": { mobile: 0.7 },
  // DevOps
  Shell: { devops: 0.4 },
  Dockerfile: { devops: 0.7 },
  HCL: { devops: 0.8 }, // Terraform
};

function scoreShallowRepo(repo: GitHubRepo): DomainScores {
  const out: DomainScores = { ...ZERO };
  if (!repo.language) return out;

  const hint = LANGUAGE_DOMAIN_HINT[repo.language];
  if (!hint) return out;

  (Object.keys(hint) as (keyof DomainScores)[]).forEach((k) => {
    out[k] = hint[k] ?? 0;
  });

  // fork repo 는 학습/포크 용도가 많아 신호를 절반으로 약화.
  if (repo.fork) {
    (Object.keys(out) as (keyof DomainScores)[]).forEach((k) => {
      out[k] *= 0.5;
    });
  }

  return out;
}

// 사용자 도메인 점수: 전체 shallow 신호 + 대표 repo deep 신호 결합 후 정규화
export function combineDomainSignals(
  allShallowRepos: GitHubRepo[],
  representativeDomainScores: DomainScores[],
): DomainScores {
  const shallowScores = allShallowRepos.map(scoreShallowRepo);
  return aggregateDomainScores([...shallowScores, ...representativeDomainScores]);
}
