"use client";

import { useMemo } from "react";
import { Mail } from "lucide-react";

// 개발자에게 제보/문의를 보내는 버튼.
// - 클릭하면 새 탭에 Gmail 웹 작성창이 열리고, 수신자/제목/본문 템플릿이 미리 채워진다.
// - 별도 서버/폼 없이 동작하므로 in-memory 구조와 충돌하지 않는다.
const FEEDBACK_EMAIL = "0215wldus@sookmyung.ac.kr";

const FEEDBACK_SUBJECT = "[GitHub 개발 활동 보고서] 제보 / 개선 문의";

// 사용자가 채우기 쉽도록 항목을 미리 나눠 둔다. (자유롭게 수정/삭제 가능)
const FEEDBACK_BODY = `안녕하세요. 서비스를 사용해 본 뒤 제보/개선 의견을 보냅니다.
아래 항목 중 해당되는 것만 채워주셔도 됩니다.

■ GitHub 계정명
(분석에 사용한 username 또는 본인 계정)

■ 사용 모드
(게스트 / GitHub 로그인 / private 포함 여부)

■ 버그가 발생한 상황
(어떤 화면에서 · 무엇을 눌렀을 때 · 어떤 결과가 나왔는지)

■ 기대했던 동작
(원래는 어떻게 동작하길 기대했는지)

■ 개선 제안 / 마음에 안 든 부분
(LLM 결과 문장 · 분야 점수 · 기술 스택 추출 · 대표 repo 선정 등 구체적으로)

■ 사용 환경 (선택)
(브라우저 / OS / 선택한 LLM 모델)
`;

type Props = {
  className?: string;
};

export default function FeedbackButton({ className }: Props) {
  // Gmail 웹 작성창(새 탭)으로 연다. su=제목, body=본문, to=수신자.
  const href = useMemo(
    () =>
      `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
        FEEDBACK_EMAIL,
      )}&su=${encodeURIComponent(FEEDBACK_SUBJECT)}&body=${encodeURIComponent(
        FEEDBACK_BODY,
      )}`,
    [],
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className ??
        "flex items-center gap-2 px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
      }
      title={`개발자에게 메일 보내기 (${FEEDBACK_EMAIL})`}
    >
      <Mail className="w-3.5 h-3.5" />
      개발자에게 제보 / 문의
    </a>
  );
}
