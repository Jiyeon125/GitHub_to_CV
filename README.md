# GitHub 개발자 활동 리포트 PoC

GitHub 공개 프로필·저장소를 가져와 대표 레포 3개와 요약을 보여 주는 **1단계 검증용** Next.js 앱입니다.

## 이 PoC가 하는 일

- GitHub 사용자명을 입력받습니다.
- `/api/analyze`를 호출합니다.
- GitHub REST API로 **공개 프로필·공개 저장소**를 가져옵니다.
- 규칙 기반으로 저장소 점수를 매깁니다.
- 대표 저장소 **상위 3개**를 보여 줍니다.
- 주요 언어, README 존재 여부 등을 요약해 보여 줍니다.
- 로딩·빈 결과·에러 상태를 처리합니다.


## 실행

1. [Node.js LTS](https://nodejs.org) 설치
2. pnpm이 없으면 한 번만 전역 설치: `npm install -g pnpm`
3. 프로젝트 루트에서:

```bash
pnpm install
pnpm dev
```

4. 브라우저에서 http://localhost:3000

### (선택) GitHub 토큰

API 호출 한도를 넉넉히 쓰려면 환경 변수 `GITHUB_TOKEN`을 설정합니다. 없어도 동작하지만 rate limit에 더 빨리 걸릴 수 있습니다.

## 범위

인증·DB·차트·PDF·LLM 요약 등은 포함하지 않습니다.
