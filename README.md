# GitHub 개발자 활동 리포트 PoC

GitHub 활동 리포트 서비스의 **1단계 검증**을 위해 만든 Next.js + TypeScript 최소 PoC입니다.

## 이 PoC가 하는 일

- GitHub 사용자명을 입력받습니다.
- `/api/analyze`를 호출합니다.
- GitHub REST API로 **공개 프로필·공개 저장소**를 가져옵니다.
- 규칙 기반으로 저장소 점수를 매깁니다.
- 대표 저장소 **상위 3개**를 보여 줍니다.
- 주요 언어, README 존재 여부 등을 요약해 보여 줍니다.
- 로딩·빈 결과·에러 상태를 처리합니다.

## 실행 방법 (pnpm 데모)

1. pnpm 설치(최초 1회):

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

2. 의존성 설치:

```bash
pnpm install
```

3. (선택) API 호출 한도를 넉넉히 쓰려면 토큰 설정:

```bash
# macOS / Linux
export GITHUB_TOKEN=your_token_here

# Windows PowerShell
$env:GITHUB_TOKEN="your_token_here"
```

4. 개발 서버 실행:

```bash
pnpm dev
```

5. 브라우저에서 http://localhost:3000 열기


## 참고

- `GITHUB_TOKEN`이 없어도 동작하지만, GitHub API **속도 제한(rate limit)** 에 더 빨리 걸릴 수 있습니다.
- 인증, DB 저장, 차트, 내보내기, LLM 요약 등은 현재 poc 단계에서 의도적으로 포함하지 않았습니다.
