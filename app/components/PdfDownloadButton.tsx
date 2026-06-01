"use client";

import { useMemo } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { FileDown } from "lucide-react";
import PdfReportDocument from "./PdfReportDocument";
import type { AnalyzeResponse } from "@/lib/types";

type Props = {
  data: AnalyzeResponse | null;
  disabled?: boolean;
};

function sanitizeFileName(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").trim() || "github-report";
}

export default function PdfDownloadButton({ data, disabled = false }: Props) {
  const fileName = useMemo(() => {
    if (!data) return "github-report.pdf";
    const date = new Date(data.generatedAt).toISOString().slice(0, 10);
    return `${sanitizeFileName(data.username)}-github-report-${date}.pdf`;
  }, [data]);

  // PDFDownloadLink 는 생성한 blob 을 내부에서 캐시해 document prop 이 바뀌어도
  // 자동 재생성하지 않는다(@react-pdf/renderer 알려진 동작). 분석 결과가 바뀌면
  // (재분석 시각 + 대표 repo 개수) 기준 key 로 강제 재마운트해 항상 최신 PDF 를 생성한다.
  const pdfKey = useMemo(
    () => (data ? `${data.generatedAt}:${data.selectedRepos.length}` : "empty"),
    [data],
  );

  const baseClassName =
    "flex items-center gap-2 px-3 py-1.5 text-xs border border-border rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  if (!data || disabled) {
    return (
      <button type="button" disabled className={baseClassName}>
        <FileDown className="w-3.5 h-3.5" />
        PDF 파일 다운로드
      </button>
    );
  }

  return (
    <PDFDownloadLink
      key={pdfKey}
      document={<PdfReportDocument data={data} />}
      fileName={fileName}
      className={baseClassName}
    >
      {({ loading }) => (
        <>
          <FileDown className="w-3.5 h-3.5" />
          {loading ? "PDF 생성 중..." : "PDF 파일 다운로드"}
        </>
      )}
    </PDFDownloadLink>
  );
}
