"use client";

import YouTubeTrackedPlayer, {
  OnTick,
  OnViolation,
} from "./YouTubeTrackedPlayer";
import dynamic from "next/dynamic";
import { authFetch } from "@/lib/authFetch";
import LocalVideoTrackedPlayer from "./LocalVideoTrackedPlayer";

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
  youtubeUrl?: string | null; // link YouTube
  videoUrl?: string | null; // link mp4 nội bộ (hoặc http(s) khác)

  // PDF (embed)
  pdfUrl?: string | null;

  // Dùng cho VIDEO/PDF nếu cần
  durationSeconds?: number | null;

  // Dùng chung
  resumeFromSeconds?: number;
  onValidWatchTick?: OnTick;
  onViolation?: OnViolation; // chỉ áp cho video
  onEnded?: () => void;

  /** Bài đã 100% → tắt guard video/PDF */
  disableGuards?: boolean;

  /** cho PDF & lưu progress */
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
    videoUrl,
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

  // ================== PDF: handler lưu progress ==================
  async function handlePdfPageProgress(info: {
    completedPages: number;
    totalPages: number;
    currentPage: number;
  }) {
    // báo cho parent update UI (như trước đây)
    if (onPageProgress) {
      try {
        onPageProgress(info);
      } catch (e) {
        console.error("onPageProgress handler error:", e);
      }
    }

    // không có lessonId thì thôi
    if (!lessonId) return;

    try {
      await authFetch(`/lessons/${lessonId}/progress`, {
        method: "PATCH",
        body: JSON.stringify({
          // PDF không dùng watchedSeconds / lastPositionSec nhưng BE có thể expect field
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

  // ================== VIDEO ==================
  if (type === "video") {
    // 1) Link YouTube → dùng YouTubeTrackedPlayer
    if (youtubeUrl) {
      return (
        <YouTubeTrackedPlayer
          youtubeUrl={youtubeUrl}
          durationSeconds={durationSeconds ?? undefined}
          resumeFromSeconds={resumeFromSeconds}
          onValidWatchTick={onValidWatchTick}
          onViolation={disableGuards ? undefined : onViolation}
          onEnded={disableGuards ? undefined : onEnded}
          disableGuards={disableGuards}
          storageNamespace={lessonId} // để sau này muốn lưu resume theo lessonId
        />
      );
    }

    // 2) Video mp4 nội bộ / video http(s) khác → LocalVideoTrackedPlayer
    if (videoUrl) {
      return (
        <LocalVideoTrackedPlayer
          src={videoUrl}
          durationSeconds={durationSeconds ?? undefined}
          resumeFromSeconds={resumeFromSeconds}
          onValidWatchTick={onValidWatchTick}
          onViolation={disableGuards ? undefined : onViolation}
          onEnded={disableGuards ? undefined : onEnded}
          disableGuards={disableGuards}
        />
      );
    }
  }

  // ================== PDF ==================
  if (type === "pdf" && pdfUrl) {
    return (
      <PdfTrackedViewer
        pdfUrl={pdfUrl}
        minSecondsPerPage={30}
        onValidWatchTick={onValidWatchTick}
        onEnded={onEnded}
        disableGuards={disableGuards}
        lessonId={lessonId}
        onPageProgress={handlePdfPageProgress}
        initialCompletedPages={initialPdfCompletedPages}
        initialTotalPages={initialPdfTotalPages}
        initialPage={initialPage}
      />
    );
  }

  // ================== Fallback ==================
  return <div>Chưa hỗ trợ nội dung này.</div>;
}
