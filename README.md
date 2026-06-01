# GitHub 개발 활동 보고서 생성 서비스

## 한 줄 소개

GitHub 으로 로그인한 본인의 저장소(원하면 private 포함) 를 분석해 개발자 활동 요약, 기술 스택 분포, 대표 프로젝트 설명, 포트폴리오 문장, 이력서 bullet, 예상 면접 질문을 생성하는 Gen AI 기반 리포트 서비스입니다. (로그인하지 않으면 임의 username 의 공개 저장소를 테스트용으로 분석할 수 있습니다.)

## 문제 정의

GitHub에는 개발 활동 정보가 풍부하지만, 취업 준비생이나 학생 개발자는 이를 포트폴리오 / 이력서 언어로 정리하기 어렵습니다. 특히 README가 없거나 부실한 경우 단순 요약 방식은 잘못된 결과를 만들 수 있고, 활동 시간대 같은 메타 정보 역시 단정적으로 표현되면 오히려 오해를 부릅니다.

## 해결 방법

본 서비스는 README를 그대로 요약하지 않고, **repository 구조 / 설정 파일 / commit history / 기술 스택 정보를 함께 규칙 기반으로 분석**한 뒤, 그 결과를 LLM에 **요약된 feature 형태로만** 전달하여 사용자 수준 리포트와 repo별 산출물을 생성합니다.

- README 신뢰도를 평가하고 부족한 부분은 구조 / commit 로 보완
- 전체 코드를 LLM에 넣지 않고 요약 feature 만 전달해 비용을 줄임
- 결과는 단정 표현 대신 "공개 저장소 기준 추정 / 경향" 으로 표현

## 주요 기능

- **GitHub OAuth 로그인** (NextAuth + `next-auth/providers/github`) — 로그인하면 본인의 private repo 까지 분석 가능
- **게스트 / 테스트 모드** — 비로그인 상태에서는 임의 username 의 공개 repo 만 분석 (개발/검증용. 이후 비활성화 예정). 게스트가 사이드바에 본인 GitHub PAT 를 입력하면 인증 호출로 GitHub rate limit 을 완화할 수 있음
- GitHub repository 수집 (1차 shallow + 2차 deep)
- 분석은 사용자의 **전체 저장소** 를 대상으로 진행 (shallow 수집 + 언어 기반 도메인 신호)
- 그 중 **대표 repo 를 자동 선정**해 카드 형태로 표시 (사이드바 슬라이더로 개수 조절. self 모드 또는 게스트 PAT 입력 시 1~5개, 미인증 게스트는 1~3개로 제한)
- README 신뢰도 평가 (high / medium / low / missing)
- 구조 / commit 기반 프로젝트 분석
- 설정 파일 + 디렉토리 구조 기반 기술 스택 추출
- 분야별 점수 계산 (Frontend / Backend / Data·ML / Mobile / DevOps / Collaboration, 0~100 정규화)
- 활동 패턴 분석 (사용자가 선택한 타임존 기준 야간 / 오전 / 주말 비율, 일관성, 태그. 기본값은 브라우저 감지 타임존)
- LLM 기반 사용자 한 줄 요약 + 종합 요약
- repo별 포트폴리오 문장 / 이력서 bullet / 예상 면접 질문 생성
- LLM 생성 문장(요약 / 포트폴리오 / 이력서 bullet / 면접 질문)에 **복사 버튼 + "AI 초안 · 검토 필요" 안내** 제공 (사용용 전 사용자가 외부 문서에 붙여넣어 다듬는 흐름 지원)
- SVG 6축 레이더 차트, 기술 스택 분포 막대, 활동 패턴 패널
- README / 분석 신뢰도 badge, 경고 박스
- PDF 저장 / 브라우저 인쇄형 출력 (`@media print`)
- in-memory TTL 캐시 (10분) — 동일 입력 재분석 시 GitHub API 호출 비용 절감

## 기술 스택

실제 프로젝트에서 사용 중인 항목만 기재합니다.

- **Frontend / UI**: React 18, Next.js 14 (App Router), TypeScript 5, Tailwind CSS + Radix UI (globals.css 에 테마/인쇄 스타일)
- **Backend / API**: Next.js Route Handler (`app/api/analyze/route.ts`, `app/api/auth/[...nextauth]/route.ts`)
- **Authentication**: NextAuth.js v4 + GitHub OAuth Provider (JWT 세션, 별도 DB 불필요)
- **External API**: GitHub REST API v3 (users, repos, readme, git tree, languages, commits, contents) — 로그인 사용자는 OAuth access token, 그 외에는 `GITHUB_TOKEN` 또는 미인증 호출
- **LLM**: 숙명여자대학교 [API Gateway (Mindlogic factchat)](https://docs.mindlogic.ai/docs/sookmyung/gateway/getting-started/overview) — OpenAI 호환 Chat Completions 형식, 단일 키로 OpenAI / Claude / Gemini 모델에 접근. 사이드바 기본 선택값은 GPT 프리셋(`gpt-5.4`), 프리셋별 모델 ID 는 env 로 교체 가능
- **Visualization**: 외부 차트 라이브러리 없이 자체 작성한 SVG 레이더 + 막대 차트
- **Cache / Rate limit**: 프로세스 메모리(in-memory) 기반 TTL 캐시 + IP rate limit (별도 DB 없이 동작)
- **Test / CI**: Vitest 단위 테스트 + GitHub Actions (`lint → typecheck → test → build`) + Dependabot
- **Deployment**: Vercel (정적/서버리스), Node.js LTS

> 외부 차트 라이브러리, 상태 관리 라이브러리, 영속 DB 는 사용하지 않습니다. 캐시 / rate limit 은 in-memory 로 동작합니다. (다중 인스턴스 일관성이 필요할 때의 공유 저장소 도입안은 아래 "확장안 제안" 참고)

## 시스템 흐름

```
[옵션] GitHub 로 로그인 → NextAuth 가 access_token 을 JWT 쿠키에 저장
        ├─ scope: read:user repo  (private repo 분석 동의 시 활용)
        └─ access_token 은 서버 라우트에서만 getToken() 으로 접근

사이드바 분석 시작
  └─► POST /api/analyze
        ├─ 입력 검증 + IP rate limit (route.ts)
        ├─ NextAuth JWT 에서 access_token / login 확인 → 모드는 로그인 여부로 자동 결정
        │     ├─ 로그인 → self 모드: 본인 username 강제(클라이언트 username 무시), OAuth token 으로 호출
        │     └─ 미로그인 → public 모드: 게스트가 PAT 를 입력했으면 그 토큰, 아니면 서버 GITHUB_TOKEN(있다면), 둘 다 없으면 미인증 호출
        ├─ 캐시 hit 시 즉시 응답 (cache.ts: in-memory TTL, key 에 mode + private + timezone 포함)
        ├─ 1차 shallow 수집: repo 메타데이터
        │     ├─ self+private: /user/repos?visibility=all (private 포함)
        │     ├─ self+public:  /user/repos?visibility=public
        │     └─ public:       /users/{username}/repos
        ├─ 대표 repo 선정 (scoring.ts: computeShallowScore) — 사이드바 슬라이더 개수만큼 (기준은 아래 "대표 repo 선정 기준")
        ├─ 2차 deep 수집: 대표 repo 만 (github.ts: fetchDeepRepoData)
        │     └─ README / root tree / languages / 최근 commit 10 / 설정 파일
        ├─ 규칙 기반 분석
        │     ├─ README 신뢰도 (readmeReliability.ts)
        │     ├─ 기술 스택 추출 (techStack.ts)
        │     ├─ 분야별 점수 (domainScores.ts → 전체 shallow 신호 + 대표 deep 신호 합산 후 0~100 정규화)
        │     ├─ 활동 패턴 (activityPattern.ts, 사용자 선택 타임존 기준 · 기본 브라우저 감지)
        │     └─ 태그 후보 (tags.ts)
        ├─ (선택) LLM 호출 via Sookmyung API Gateway (llm.ts)
        │     ├─ 사용자 리포트 1회
        │     └─ repo 분석 묶음 1회 (N개 모아서 단일 호출)
        │     └─ temp=0 + seed + stableStringify 로 호출 재현성 확보
        └─ AnalyzeResponse 반환
  └─► Dashboard 렌더링
        ├─ headline / summary / 경고 / 태그
        ├─ 레이더 / 기술 스택 / 활동 패턴
        └─ 대표 repo 카드 (포트폴리오 문장 / 이력서 bullet / 면접 질문)
  └─► [PDF로 저장 / 인쇄] → window.print() + @media print
```

## 대표 repo 선정 기준

전체 저장소에 규칙 기반 점수를 매겨 후보를 추리고, (LLM 사용 시) 포트폴리오 관점으로 리랭킹해 최종 대표 repo 를 고릅니다.

**1. 규칙 점수 (`scoring.ts: computeShallowScore` → deep 수집 후 `refineScoreWithDeepData`, 0~100)**

"이력서 대표성" 관점에서 **실속(구조·README) 우선**으로 가중치를 둡니다.

| 신호 | 점수 | 설명 |
|---|---|---|
| 구조 (파일/폴더) | +20 | deep 수집 후. 루트 엔트리 3개 이상이면 만점, 1~2개 부분 점수 |
| README | +15 | deep 수집 후. README 존재 시 |
| 최근성 | +15 | `updated_at` / `pushed_at` 중 **더 최근 값** 기준, 1년 이상 활동 없으면 0 |
| 배포 (homepage/Pages) | +10 | 실제 배포 URL 이 있으면 가산 (포트폴리오 강신호) |
| description | 0~10 | 설명 길이에 비례한 연속 점수, 없으면 0 |
| 활동성 (star/fork) | 0~8 | log scale. 학생·취준생 repo 는 변별력이 낮아 보조 신호로만 |
| topics | +5 | 분류/관리 의지 신호 |
| archived/disabled | -25 | 보관·비활성(죽은) repo 강등 (완전 제외는 아님) |
| fork | -5 ~ -10 | description 유무로 차등 (본인 작성 설명이 있으면 완화) |
| 튜토리얼/클론 패턴 | -15 | 이름·설명이 학습용(`tutorial`, `clone`, `boilerplate` 등) |
| 빈 repo (size) | -10 ~ -20 | 사실상 비어 있는 repo |

**2. 후보 풀 구성 (`analyze.ts`)** — 규칙 점수 상위 K 개(보통 ~12개)를 후보 풀로 사용합니다. 별도 다양성 알고리즘은 두지 않고, "여러 언어/도메인을 고르게 보여주기"는 아래 LLM 리랭킹 단계에 맡깁니다.

**3. (선택) LLM 리랭킹 (`llm.ts: rerankRepoSelection`)** — 후보의 **메타데이터**(이름/설명/언어/topics/별점/사이즈/recency/배포 URL/보관 여부)에 더해, **인증된 호출(로그인 또는 서버 토큰)일 때는 각 후보의 README 앞부분 스니펫(~500자)** 을 함께 보내 포트폴리오 관점에서 N 개를 선정합니다(다양성도 이 단계에서 반영). 전체 코드 본문은 보내지 않아 토큰 비용·할루시네이션·private 노출을 억제하고, 미인증 호출에서는 rate limit 부담을 피하려 스니펫 없이 메타데이터만 사용합니다. LLM 실패 시 규칙 점수 순서로 자동 fallback 합니다.

## 파일 구조

```
app/
  api/analyze/route.ts          # 입력 검증 + rate limit + 캐시 + NextAuth 세션 검증
  api/auth/[...nextauth]/route.ts  # NextAuth App Router 핸들러
  components/                   # Sidebar, Dashboard, RadarChart, Panels, RepoCard, Badges, LoadingProgress
  globals.css                   # 화면 + 인쇄 스타일
  layout.tsx, page.tsx
  providers.tsx                 # client SessionProvider 래퍼
lib/
  auth.ts                # NextAuth authOptions (GitHub OAuth, JWT)
  analyze.ts             # 수집 → 분석 → LLM 오케스트레이션 (mode/private 인자 추가)
  github.ts              # GitHub REST 클라이언트 (user token + visibility 옵션)
  scoring.ts             # 대표 repo 규칙 점수 (실속 우선 가중치, shallow→deep 보정)
  readmeReliability.ts   # high / medium / low / missing 평가
  techStack.ts           # 설정 파일 / 구조 기반 스택 추출
  domainScores.ts        # 6축 분야 점수 + 0~100 정규화
  activityPattern.ts     # commit 기반 패턴 (사용자 선택 타임존 환산, Intl 기반 DST 반영)
  tags.ts                # 사용자 태그 후보
  llm.ts                 # Mindlogic API Gateway 호출 + JSON 파싱 fallback
  cache.ts               # in-memory TTL 캐시
  types.ts               # 공통 타입
lib/__tests__/           # Vitest 단위 테스트 (scoring / domainScores / activityPattern / readmeReliability / techStack / tags / llm)
.github/
  workflows/ci.yml       # lint → typecheck → test → build
  dependabot.yml         # 주간 npm / github-actions 업데이트 PR
```

## 실행 방법

1. Node.js LTS 설치
2. (1회) `npm install -g pnpm`
3. 프로젝트 루트에서:

```bash
pnpm install
pnpm dev
```

4. 브라우저에서 http://localhost:3000

빌드 / 린트 / 타입체크 / 테스트:

```bash
pnpm lint
pnpm typecheck
pnpm test        # Vitest 단위 테스트 (watch: pnpm test:watch)
pnpm build
```

## 환경 변수 설정

`.env.example` 을 참고해 `.env.local` 을 생성합니다. (`.env*` 는 `.gitignore` 에 등록되어 있고 `.env.example` 만 커밋됩니다. API 키는 절대 README 나 클라이언트 코드에 적지 마세요.)

```env
# GitHub OAuth (NextAuth)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# (선택) 미로그인 게스트 모드용 PAT
GITHUB_TOKEN=

# 숙명여자대학교 API Gateway (Mindlogic factchat)
MINDLOGIC_API_KEY=
# MINDLOGIC_BASE_URL=https://factchat-cloud.mindlogic.ai/v1/gateway
# (하위 호환) 설정 시 GPT 프리셋이 이 모델 ID 를 사용
# MINDLOGIC_MODEL=gpt-5.4

# LLM_TEMPERATURE=0
```

| 변수 | 설명 |
| --- | --- |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth App 의 Client ID / Secret. 로그인 기능을 사용하려면 필수. |
| `NEXTAUTH_SECRET` | NextAuth JWT 서명/암호화에 사용할 임의 문자열. `openssl rand -base64 32` 로 생성. |
| `NEXTAUTH_URL` | 배포 URL. 개발 시 `http://localhost:3000`, 배포 시 `https://github-to-cvjiyeon125.vercel.app`. |
| `GITHUB_TOKEN` | (선택) 비로그인 게스트 모드에서 GitHub API rate limit 완화용 PAT. 로그인 사용자에게는 영향 없음. |
| `MINDLOGIC_API_KEY` | 숙명여대 API Gateway 키. 이 키가 있으면 사이드바의 프리셋(GPT/Claude/Gemini)으로 LLM 요약 활성화. |
| `MINDLOGIC_BASE_URL` | (선택) 게이트웨이 base URL. 기본 `https://factchat-cloud.mindlogic.ai/v1/gateway`. |
| `MINDLOGIC_MODEL_GPT` / `MINDLOGIC_MODEL_CLAUDE` / `MINDLOGIC_MODEL_GEMINI` | (선택) 각 프리셋이 실제 호출할 모델 ID. 기본값은 `gpt-5.4`, `claude-sonnet-4-6`, `gemini-2.5-pro`. 권한 있는 ID 는 `GET /v1/gateway/models` 로 확인. |
| `MINDLOGIC_MODEL` | (하위 호환·선택) 단일 모델 ID 만 쓰던 옛 환경 변수. 설정 시 "GPT" 프리셋이 이 값을 사용. |
| `LLM_TEMPERATURE` | 기본 0. 호출마다 비슷한 결과를 받기 위한 샘플링 온도. 0~0.3 권장. |

`MINDLOGIC_API_KEY` 가 없으면 사이드바의 "LLM 요약 생성" 을 켜도 자동으로 규칙 기반 결과만 표시되며, 응답 경고 박스에 안내가 노출됩니다. 단, 사용자가 사이드바의 "직접 입력 (Custom)" 옵션에 자신의 OpenAI 호환 API 키 / Base URL / 모델을 넣은 경우에는 서버 키 없이도 LLM 요약을 생성할 수 있습니다.

### 사이드바에서 모델 선택하기

사이드바의 **LLM 요약 생성** 토글을 켜면 모델 프리셋이 나타납니다.

- **OpenAI GPT (gpt-5)** — **앱 기본 선택값**. `temperature=0` + `seed` 반영이 가장 안정적이라 본 서비스의 JSON 강제 출력과 잘 맞습니다. (기본 모델 ID: `gpt-5.4`)
- **Anthropic Claude Sonnet** — 한국어 문장의 자연스러움이 강점. (기본 모델 ID: `claude-sonnet-4-6`)
- **Google Gemini 2.5 Pro** — 긴 컨텍스트와 속도 균형. 게이트웨이 호환을 위해 `seed` 파라미터는 자동으로 빼서 호출합니다.
- **직접 입력 (Custom)** — 사용자가 자신의 OpenAI 호환 API 키 / Base URL / 모델 ID를 넣어 호출. 키는 서버 호출에만 사용되고 브라우저/서버에 저장되지 않으며 새로고침 시 사라집니다.

> 경량 모델(mini / nano / flash)은 본 서비스의 JSON 출력 규약과 어휘 화이트리스트를 자주 어겨 의도적으로 프리셋에서 제외했습니다. 필요하면 "직접 입력"에서 사용할 수 있습니다.
> 권한 있는 모델 목록은 `curl -H "Authorization: Bearer $MINDLOGIC_API_KEY" https://factchat-cloud.mindlogic.ai/v1/gateway/models` 로 확인할 수 있습니다.

### GitHub OAuth App 등록

1. https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**
2. Homepage URL:
   - 로컬: `http://localhost:3000`
   - 배포: `https://github-to-cvjiyeon125.vercel.app`
3. Authorization callback URL:
   - 로컬: `http://localhost:3000/api/auth/callback/github`
   - 배포: `https://github-to-cvjiyeon125.vercel.app/api/auth/callback/github`
4. **Register application** → 다음 화면에서 **Generate a new client secret** 클릭
5. 발급된 `Client ID` 와 `Client Secret` 을 `.env.local` 에 입력
6. `NEXTAUTH_SECRET` 도 생성해 함께 저장

OAuth 동의 화면에서 사용자는 `read:user` (프로필) + `repo` (private repo 접근) 권한을 부여하게 됩니다. 본 서비스는 **사용자가 사이드바에서 "private 저장소도 분석에 포함" 체크박스를 켰을 때만** `visibility=all` 로 private repo 를 가져오며, 켜지 않으면 `visibility=public` 으로만 호출해 GitHub 측에는 권한이 있더라도 실제로는 공개 repo 만 분석합니다.

### Vercel 배포 체크리스트

Vercel 프로젝트의 Environment Variables에는 최소한 `NEXTAUTH_SECRET` 을 등록합니다. GitHub 로그인/private repo 분석을 쓰려면 `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `NEXTAUTH_URL=https://github-to-cvjiyeon125.vercel.app` 도 함께 등록하고, GitHub OAuth App의 callback URL에도 같은 배포 도메인을 추가해야 합니다. 공개 저장소 분석만 사용할 때는 OAuth 변수가 없어도 동작하며, `GITHUB_TOKEN` 은 rate limit 완화가 필요할 때만 추가합니다.

Vercel 은 다중 서버리스 인스턴스로 동작하므로, 현재 in-memory 캐시 / rate limit 은 인스턴스별로 따로 유지됩니다. 데모/수업용 규모에서는 충분하지만, 인스턴스 간 일관성이 필요해지면 아래 "확장안 제안" 의 공유 저장소(예: Neon Postgres / Upstash) 도입을 고려하세요.

**API 키 보안 권장사항** ([Mindlogic 가이드](https://docs.mindlogic.ai/docs/sookmyung/gateway/getting-started/authentication#보안) 기준):

- API 키는 환경 변수(`.env.local`) 에만 저장하고 소스 코드/커밋에 포함하지 않습니다.
- `.env*` 는 본 프로젝트 `.gitignore` 에 등록되어 있으며 `.env.example` 만 커밋됩니다.
- 키가 노출됐다면 즉시 Mindlogic API Gateway 페이지에서 해당 키를 해지하고 새 키를 발급받습니다.
- HTTPS 엔드포인트만 사용하며, 본 코드의 기본 `MINDLOGIC_BASE_URL` 도 HTTPS 입니다.
- 키는 발급된 테넌트에 한해서만 모델에 접근 가능합니다.

### 왜 숙명여대 API Gateway 인가

[Mindlogic 문서](https://docs.mindlogic.ai/docs/sookmyung/gateway/getting-started/overview) 에 따르면 본 게이트웨이는 OpenAI / Anthropic / Google Gemini / xAI / Perplexity 의 모델을 **OpenAI 호환 Chat Completions 형식 + 단일 키 + 단일 base URL** 로 제공합니다. 본 프로젝트는 다음 이유로 이를 사용합니다.

- 학내 발급 키 하나로 GPT / Claude / Gemini 계열 모델을 자유롭게 교체해 비교 가능
- 기존 OpenAI SDK 호출 형식을 그대로 사용 → 코드 변경 폭이 작음 (`base URL` 만 교체)
- 모델 ID 만 환경 변수로 교체 (`MINDLOGIC_MODEL=gpt-4o-mini` 등) → 발표 시 모델별 결과 비교 시연 용이

### LLM 재현성 (determinism)

같은 사용자에 대해 여러 번 분석해도 비슷한 어휘/문장이 나오도록 다음 장치를 적용했습니다.

- **샘플링 파라미터를 greedy 에 가깝게 고정**: `temperature=0`, `seed=<payload 해시>`. `top_p` / `frequency_penalty` / `presence_penalty` 는 게이트웨이 뒷단 모델(특히 Claude) 이 거절하므로 보내지 않음.
- **입력 페이로드 stable serialization**: 객체 key 를 알파벳 순으로 정렬해 직렬화하므로 같은 입력 → 항상 같은 문자열이 모델로 들어감 (`stableStringify`)
- **결정적 seed 계산**: `(프롬프트 버전 + 정렬된 payload)` 의 32-bit 해시를 OpenAI 호환 `seed` 파라미터로 전달. 프롬프트 본문이나 호출 파라미터 형태가 바뀌면 `PROMPT_VERSION` 도 함께 올려 seed 가 자동 무효화됨.
- **프롬프트 자유도 축소**: headline / portfolio_sentence / resume_bullet 의 종결 어휘를 화이트리스트로 제한, 길이·항목 수를 정수로 고정, 1개의 few-shot 예시로 톤·구조 잠금.

> 게이트웨이 뒤 모델이 GPT 계열이면 `seed` 가 그대로 반영되어 사실상 byte 단위에 가까운 재현이 가능합니다. Claude / Gemini 계열은 `seed` 를 무시할 수 있지만, `temperature=0` 만으로도 그리디 디코딩에 가까워 어휘 / 문장 구조의 큰 변동은 사라집니다.

### JSON 강제 출력 처리

게이트웨이 뒤의 모델에 따라 `response_format` 필드가 요구하는 형식이 다릅니다 (OpenAI: `json_object`, Anthropic: `json_schema`, Gemini: 별도). 어떤 모델로 라우팅돼도 동작하도록 본 프로젝트는 **`response_format` 을 보내지 않고**, 다음 3-단계로 JSON을 강제/복구합니다.

1. system prompt 첫 줄에서 "JSON 한 객체만 출력, 다른 텍스트 금지" 강제
2. `tryParseJson` 이 정상 JSON / ```json ... ``` 코드 블록 / 첫 `{` ~ 마지막 `}` 그리디 매칭 순서로 시도
3. 모두 실패하면 응답을 폐기하고 규칙 기반 결과만 표시 (UI 경고 박스에 노출)

## 테스트 / 동작 확인 가이드

### 자동화 테스트

핵심 규칙 기반 로직(점수화 / 도메인 점수 / 활동 패턴 / README 신뢰도 / 기술 스택 추출 / 태그 / LLM JSON 복구)은 Vitest 단위 테스트로 검증합니다.

```bash
pnpm test          # 1회 실행 (CI 와 동일)
pnpm test:watch    # 변경 감지 watch 모드
```

테스트 파일은 `lib/__tests__/*.test.ts` 에 있습니다.

### 수동 동작 확인

다음과 같은 GitHub 사용자 유형에 대해 직접 입력하면서 동작을 점검할 수 있습니다. (특정 사용자명을 코드에 하드코딩하지 않았고, 사이드바에 자유롭게 입력 가능합니다.)

| 유형 | 확인 포인트 |
| --- | --- |
| repo가 많은 사용자 (예: 유명 오픈소스 메인테이너) | shallow 페이지네이션(최대 1000개) / 대표 repo 선정 / 캐시 동작 |
| repo가 적은 사용자 | 빈 상태 UI / "분석 가능한 공개 저장소가 부족" 경고 |
| README가 부실한 repo가 많은 사용자 | README badge가 low / missing 으로 표시 / 분석 신뢰도 보수적 표시 |
| fork repo가 많은 사용자 | "fork 저장소만 공개" 경고 / fork 감점이 점수에 반영 |
| commit 정보가 적은 사용자 | 활동 패턴 표본 부족 처리 / "공개 repo 정보 부족" 태그 |

각 케이스에서 다음을 확인합니다.

- 앱이 정상 실행되는가
- 사이드바에서 지정한 개수만큼 대표 repo 카드와 PDF 대표 저장소가 표시되는가 (미인증 게스트는 최대 3)
- README 신뢰도 badge가 표시되는가
- 기술 스택이 어느 정도 납득 가능하게 추출되는가
- 분야별 점수가 0~100 범위로 표시되는가
- repo 카드가 깨지지 않는가
- LLM 결과가 없을 때도 기본 분석 결과가 보이는가
- PDF / 인쇄형 출력이 가능한가 ([PDF로 저장 / 인쇄] 버튼 → 브라우저 인쇄 다이얼로그에서 "대상 → PDF로 저장")

## 예외 처리

UI에 사용자 친화적 한국어 메시지로 표시합니다.

| 상황 | 처리 |
| --- | --- |
| (미로그인) username 미입력 | 400 + "GitHub username을 입력하십시오." |
| username 형식 오류 | 400 + "GitHub username 형식이 올바르지 않습니다." |
| 앱 자체 요청 한도 초과 (IP당 1분 20회) | 429 + "요청 한도를 초과했습니다. 잠시 후 다시 시도하십시오." |
| 존재하지 않는 username | 404 + "GitHub 사용자를 찾을 수 없습니다." |
| 공개 repo 0개 | 빈 응답 + "분석 가능한 공개 저장소가 부족합니다." 경고 |
| README 없음 | `level: missing` badge / "README가 부족하여 구조/commit 기반 추정" 안내 |
| commit 없음 / 적음 | "commit 표본 부족" 태그 / 활동 패널 빈 상태 안내 |
| GitHub API rate limit | 429 + "GitHub API 호출 한도에 도달했습니다." 안내, 가능한 경우 부분 수집 후 경고 |
| 인증 실패 (`GITHUB_TOKEN` 잘못됨) | 401 + "GITHUB_TOKEN 값을 확인하십시오." |
| 네트워크 오류 | 503 + "GitHub API에 접속하지 못했습니다." |
| LLM API key 없음 (`MINDLOGIC_API_KEY` 미설정) | 자동으로 규칙 기반 결과만 표시 + "LLM API 키가 없어 규칙 기반 분석 결과만 표시합니다." |
| LLM 호출 / JSON 파싱 실패 | LLM 영역을 비워두고 "LLM 생성에 실패하여 규칙 기반 분석 결과만 표시합니다." 경고 |
| Repo 데이터 일부 실패 | repo 단위로 격리. 다른 repo 분석은 계속 진행하고 카드에 안내 |

## 한계

- 로그인(self) 모드에서 사용자가 동의하면 private repo 도 분석하지만, **조직(organization) contribution / GitHub Pages 외부 결과물**은 반영되지 않습니다. 비로그인 분석은 공개 저장소만 대상으로 합니다.
- README / commit / 구조 기반 추정이므로 실제 프로젝트 의도와 다를 수 있습니다.
- GitHub API rate limit의 영향을 받습니다. 미인증 호출은 시간당 60회 제한에 빠르게 도달할 수 있으며, 로그인(OAuth) 또는 게스트 PAT 입력 시 시간당 5000회로 완화됩니다. 그 외 앱 자체적으로 IP당 1분 20회 요청 제한이 있습니다.
- 활동 패턴은 사용자가 선택한 타임존(기본값은 브라우저 감지 타임존)으로 환산해 계산합니다. 타임존을 잘못 선택하면 야간/오전/주말 분류가 실제와 달라질 수 있습니다.
- 캐시 / rate limit 은 단일 프로세스 in-memory 로 동작합니다. 따라서 Vercel 처럼 다중 인스턴스 / 서버리스 환경에서는 인스턴스 간 캐시가 공유되지 않고 IP rate limit 도 인스턴스별로 따로 카운트됩니다. 공유가 필요하면 아래 "확장안 제안" 의 공유 저장소 도입이 필요합니다.

## 향후 개선 방향

### 게스트(다른 username) 모드 제거

현재는 모드가 로그인 여부로 자동 결정됩니다. 로그인 상태면 항상 self(본인 계정), 로그아웃 상태면 public(임의 username 의 공개 저장소)으로 동작합니다. 즉 "게스트 모드"는 별도 토글이 아니라 **로그아웃 상태 자체**입니다. 본 서비스의 최종 사용 시나리오는 "본인이 본인의 저장소를 분석" 이므로, 발표/배포 시점에는 `app/api/analyze/route.ts` 에서 미로그인(public) 분기를 제거해 로그인 필수로 좁히고, 사이드바의 username 입력란과 게스트 PAT 입력 섹션을 함께 제거하는 것이 자연스럽습니다.

### 기타

- PDF 템플릿 고도화 (사진/링크/QR 포함)
- 멘토 / 리뷰어 공유 링크
- 교육 기관용 일괄 분석 (CSV 입력 → 다수 PDF 생성)
- 진행 상태를 서버에서 SSE / streaming 으로 푸시 (현재는 클라이언트가 약 5초 간격으로 단계 메시지 전환)

## 확장안 제안 (DB / 보안)

현재는 별도 DB 없이 in-memory 로 동작하는 단일 프로세스 구조이며, 데모/수업용 규모에는 충분합니다. 사용자 수가 늘거나 다중 인스턴스(서버리스)로 본격 운영할 때를 대비해 아래 확장안을 정리해 둡니다. (지금은 적용하지 않은 단순 제안 단계입니다.)

### 1. 공유 저장소(DB) 도입

현재 캐시와 IP rate limit 은 프로세스 메모리에만 존재해, Vercel 같은 다중 서버리스 인스턴스에서는 인스턴스마다 따로 동작합니다. 공유 저장소를 붙이면 다음이 가능해집니다.

- **공유 캐시**: 어떤 인스턴스가 처리해도 동일 입력은 캐시 hit → GitHub API 호출 비용 절감, 응답 속도 향상
- **공유 rate limit**: IP별 호출 횟수를 인스턴스 간 일관되게 카운트 → 인스턴스 분산을 이용한 한도 우회 방지
- **분석 히스토리**: 과거 분석 결과 저장 / 이전 결과와 비교 / 사용자별 리포트 보관

후보 (무료 티어 기준):

| 옵션 | 특징 | 적합성 |
| --- | --- | --- |
| **Neon Postgres** | 서버리스 Postgres, HTTP 드라이버(`@neondatabase/serverless`)로 엣지/서버리스 친화 | 캐시 + 히스토리(관계형 질의)까지 한 번에. 종합 추천 |
| **Upstash Redis** | 서버리스 Redis, per-request 과금 | 캐시 / rate limit 처럼 TTL·카운터 중심 워크로드에 최적 |
| **Vercel KV** | Vercel 통합 KV(내부 Upstash) | 배포 환경이 Vercel 로 고정될 때 설정 간소 |

적용 방향: `lib/cache.ts` 와 `app/api/analyze/route.ts` 의 rate limit 을 어댑터 형태로 추상화해, 환경 변수(`DATABASE_URL` 등) 가 있으면 공유 저장소를, 없으면 지금처럼 in-memory 로 fallback 하도록 설계.

### 2. 보안 업그레이드

- **분산 rate limit**: 위 공유 저장소 기반으로 교체해 인스턴스 분산을 이용한 한도 우회를 차단. IP 단위 외에 (로그인 시) 사용자 단위 한도 추가.
- **요청 검증 강화**: 분석 API 에 대한 CSRF / Origin 검증, 입력 스키마 검증을 더 엄격하게 적용.
- **시크릿 관리**: LLM / GitHub 키를 환경 변수에만 보관(현재 적용), 추가로 주기적 키 로테이션과 노출 시 즉시 해지 절차 문서화.
- **민감 데이터 취급**: private repo 분석 결과를 저장하게 될 경우 저장 시 암호화 / 보관 기간 제한 / 사용자 삭제 요청 처리 정책 마련.
- **의존성·코드 취약점 점검**: Dependabot(현재 적용) 에 더해 GitHub CodeQL 등 SAST 를 CI 에 추가해 취약점을 사전 탐지.
- **로깅/관측성**: 에러·rate limit 이벤트를 구조화 로깅으로 남겨 남용 패턴을 모니터링.

---

## 핵심 차별점 (발표용)

1. **README를 그대로 믿지 않고 신뢰도를 평가합니다.** high / medium / low / missing 4단계로 분류하고, 구조·commit 과의 일관성으로 교차 검증합니다.
2. **구조와 commit을 함께 분석해 README 부족 문제를 보완합니다.** 설정 파일, 디렉토리 구조, 최근 commit 메시지가 README 부재를 대체합니다.
3. **전체 코드를 LLM에 넣지 않습니다.** 규칙 기반 분석으로 정리한 요약 feature(JSON)만 LLM에 전달해 호출 비용을 줄이고 hallucination 위험을 낮춥니다.
4. **단순 통계가 아니라 커리어 산출물까지 생성합니다.** 한 줄 요약 / 분야별 점수 / 포트폴리오 문장 / 이력서 bullet / 면접 질문이 한 번에 나옵니다.
5. **웹 대시보드 + PDF 결과물로 제출 가능합니다.** 별도 PDF 서버나 외부 의존 없이 브라우저 인쇄만으로 인쇄형 보고서가 출력됩니다.

## Gen AI 활용 방식

이 프로젝트에서 Gen AI는 원본 코드를 무작정 요약하는 데 쓰이지 않습니다.

먼저 규칙 기반 분석으로 GitHub 데이터를 다음과 같이 정리합니다.

- README 신뢰도 등급
- 기술 스택 후보 + 신뢰도 가중치
- 분야별 점수 (0~100)
- 활동 패턴 (시간/요일/일관성)
- 추론 메모 (예: "설정 파일 기준 프론트엔드 웹앱으로 추정")

그 다음 이 정리된 결과(JSON)를 LLM에 전달해 자연어 리포트, 포트폴리오 문장, 이력서 bullet, 예상 면접 질문을 생성합니다. 즉, **Gen AI는 "데이터 수집" 이 아니라 "해석된 결과를 커리어 언어로 변환하는 단계"** 에 사용됩니다.

LLM 응답은 JSON 스키마로 강제되며, 파싱 실패 시 규칙 기반 결과만 표시하도록 fallback이 적용되어 있어 LLM 비용 / 가용성 이슈가 발생해도 서비스 전체가 깨지지 않습니다.

## CI

`main` / `develop` 푸시 또는 PR 시 GitHub Actions에서 `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` 가 순서대로 실행됩니다. 또한 Dependabot(`.github/dependabot.yml`)이 매주 npm / github-actions 의존성 업데이트 PR 을 생성합니다.
