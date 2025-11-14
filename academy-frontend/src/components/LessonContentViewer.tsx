"use client";

import YouTubeTrackedPlayer, {
  OnTick,
  OnViolation,
} from "./YouTubeTrackedPlayer";
import dynamic from "next/dynamic";

const PdfTrackedViewer = dynamic(() => import("./PdfTrackedViewer"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        background: "#f3f4f6",
      }}
    >
      Đang tải tài liệu PDF…
    </div>
  ),
});

export type LessonContentType = "video" | "pdf" | "text" | "slide";

export default function LessonContentViewer(props: {
  type?: LessonContentType;

  // VIDEO
  youtubeUrl?: string | null;

  // PDF (embed)
  pdfUrl?: string | null;

  // Dùng cho PDF/video nếu cần
  durationSeconds?: number | null;

  // Dùng chung
  resumeFromSeconds?: number;
  onValidWatchTick?: OnTick;
  onViolation?: OnViolation; // chỉ áp cho video
  onEnded?: () => void;

  /** Bài đã 100% → tắt guard video/PDF */
  disableGuards?: boolean;

  /** cho PDF */
  lessonId?: string;
  onPageProgress?: (info: {
    completedPages: number;
    totalPages: number;
    currentPage: number;
  }) => void;
  initialPdfCompletedPages?: number;
  initialPdfTotalPages?: number;
  initialPage?: number;
}) {
  const {
    type = "video",
    youtubeUrl,
    pdfUrl,
    durationSeconds,
    resumeFromSeconds = 0,
    onValidWatchTick,
    onViolation,
    onEnded,
    disableGuards = false,
    lessonId,
    onPageProgress,
    initialPdfCompletedPages,
    initialPdfTotalPages,
    initialPage,
  } = props;

  if (type === "video" && youtubeUrl) {
    return (
      <YouTubeTrackedPlayer
        youtubeUrl={youtubeUrl}
        resumeFromSeconds={resumeFromSeconds}
        onValidWatchTick={onValidWatchTick}
        onViolation={disableGuards ? undefined : onViolation}
        onEnded={disableGuards ? undefined : onEnded}
        disableGuards={disableGuards}
      />
    );
  }

  if (type === "pdf" && pdfUrl) {
    return (
      <PdfTrackedViewer
        pdfUrl={pdfUrl}
        minSecondsPerPage={30}
        onValidWatchTick={onValidWatchTick}
        onEnded={onEnded}
        disableGuards={disableGuards}
        lessonId={lessonId}
        onPageProgress={onPageProgress}
        initialCompletedPages={initialPdfCompletedPages}
        initialTotalPages={initialPdfTotalPages}
        initialPage={initialPage}
      />
    );
  }

  return <div>Chưa hỗ trợ nội dung này.</div>;
}
