"use client";

import YouTubeTrackedPlayer, {
  OnTick,
  OnViolation,
} from "./YouTubeTrackedPlayer";
import dynamic from "next/dynamic";
import { authFetch } from "@/lib/authFetch";

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

  // ⚡ Handler riêng cho PDF: vừa báo ra ngoài, vừa gọi API lưu DB
  async function handlePdfPageProgress(info: {
    completedPages: number;
    totalPages: number;
    currentPage: number;
  }) {
    // báo cho parent (nếu có) để update UI như cũ
    if (onPageProgress) {
      try {
        onPageProgress(info);
      } catch (e) {
        console.error("onPageProgress handler error:", e);
      }
    }

    // không có lessonId thì thôi, tránh call API
    if (!lessonId) return;

    try {
      await authFetch(`/lessons/${lessonId}/progress`, {
        method: "PATCH",
        body: JSON.stringify({
          // PDF không dùng watchedSeconds / lastPositionSec nhưng BE có thể expect field → gửi 0 cho an toàn
          watchedSeconds: 0,
          lastPositionSec: 0,
          pdfCurrentPage: info.currentPage,
          pdfCompletedPages: info.completedPages,
          pdfTotalPages: info.totalPages,
        }),
      });
    } catch (e) {
      console.error("Failed to update PDF progress", e);
    }
  }

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
        // ⚡ dùng handler mới: vừa gọi onPageProgress cũ, vừa bắn API
        onPageProgress={handlePdfPageProgress}
        initialCompletedPages={initialPdfCompletedPages}
        initialTotalPages={initialPdfTotalPages}
        initialPage={initialPage}
      />
    );
  }

  return <div>Chưa hỗ trợ nội dung này.</div>;
}
