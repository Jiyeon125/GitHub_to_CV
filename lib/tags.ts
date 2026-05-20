// 사용자 태그 후보 생성
// - 도메인 점수, 활동 패턴, 기술 스택 분포를 종합해 LLM에 넘길 "후보 태그"를 만든다.
// - 최종 태그 텍스트는 LLM 응답을 통해 보정될 수 있지만, LLM이 꺼져 있어도 의미 있게 보이도록
//   여기서 충분히 다양한 후보를 만들어 둔다.

import type { ActivityPattern, DomainScores } from "./types";

// 라벨은 단정 표현을 피하고 "비중이 높음" / "경험" 같은 추정형으로 작성한다.
const DOMAIN_LABELS: Record<keyof DomainScores, string> = {
  frontend: "프론트엔드 비중 높음",
  backend: "백엔드 비중 높음",
  data_ml: "데이터/ML 비중 높음",
  mobile: "모바일 개발 경험",
  devops: "DevOps/배포 경험",
  collaboration: "문서/협업 활동",
};

export function buildTagCandidates(
  domainScores: DomainScores,
  activity: ActivityPattern,
  techDistribution: Array<{ name: string; count: number }>,
): string[] {
  const tags = new Set<string>();

  const sortedDomains = (Object.entries(domainScores) as Array<[keyof DomainScores, number]>)
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score >= 30);

  // 1순위 도메인은 그대로 추가
  if (sortedDomains[0]) {
    tags.add(DOMAIN_LABELS[sortedDomains[0][0]]);
  }
  if (sortedDomains[1] && sortedDomains[1][1] >= 50) {
    tags.add(DOMAIN_LABELS[sortedDomains[1][0]]);
  }

  for (const t of activity.activity_tags) tags.add(t);

  // 자주 등장한 기술 스택을 짧은 태그 형태로 (예: "TypeScript 중심")
  const dominantTech = techDistribution.slice(0, 2);
  for (const tech of dominantTech) {
    if (tech.count >= 2) tags.add(`${tech.name} 다수 사용`);
  }

  return Array.from(tags).slice(0, 6);
}
