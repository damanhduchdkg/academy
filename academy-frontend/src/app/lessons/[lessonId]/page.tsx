"use client";

import React from "react";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Stack,
  Chip,
  Alert,
} from "@mui/material";
import LessonContentViewer from "@/components/LessonContentViewer";
import type { LessonMeta, LessonProgress } from "@/lib/types";
import { authFetch } from "@/lib/authFetch";

/* ============ Helpers ============ */
// Ghép URL tuyệt đối về API backend (tránh localhost)
const toAbs = (u?: string | null) => {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  const base = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
  return `${base}${u.startsWith("/") ? u : `/${u}`}`;
};

// Nếu endpoint /files cần token qua query (vì iframe không gửi header)
const APPEND_TOKEN_IN_QUERY = false; // đổi true nếu BE yêu cầu token ở query
const withTokenQ = (absUrl: string | null) => {
  if (!absUrl) return null;
  if (!APPEND_TOKEN_IN_QUERY) return absUrl;
  try {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("accessToken") || ""
        : "";
    if (!token) return absUrl;
    const url = new URL(absUrl);
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return absUrl;
  }
};

const resumeKey = (lessonId: string, youtubeUrl?: string | null) => {
  try {
    if (!youtubeUrl) return `yt_resume_${lessonId}_`;
    const u = new URL(youtubeUrl);
    const vid = u.hostname.includes("youtu.be")
      ? u.pathname.replace("/", "")
      : u.searchParams.get("v") || "";
    return `yt_resume_${lessonId}_${vid}`;
  } catch {
    return `yt_resume_${lessonId}_`;
  }
};

const fmt = (sec: number) => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m ? m + " phút " : ""}${r} giây`;
};

/* ============ Page ============ */
export default function LessonPage() {
  const p = useParams() as { lessonId?: string | string[] };
  const rawId = p?.lessonId;
  const lessonId = Array.isArray(rawId) ? rawId[0] : rawId || "";

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [meta, setMeta] = React.useState<LessonMeta | null>(null);
  const [progress, setProgress] = React.useState<LessonProgress | null>(null);

  const [watched, setWatched] = React.useState(0);
  const [pos, setPos] = React.useState(0);
  const [violated, setViolated] = React.useState(false);

  // PDF: số trang hoàn thành / tổng trang / trang hiện tại
  const [pdfCompletedPages, setPdfCompletedPages] = React.useState(0);
  const [pdfTotalPages, setPdfTotalPages] = React.useState(0);
  const [pdfCurrentPage, setPdfCurrentPage] = React.useState(1);

  // nhận từ PdfTrackedViewer
  const handlePageProgress = React.useCallback(
    (info: {
      completedPages: number;
      totalPages: number;
      currentPage: number;
    }) => {
      setPdfCompletedPages(info.completedPages || 0);
      setPdfTotalPages(info.totalPages || 0);
      setPdfCurrentPage(info.currentPage || 1);
    },
    []
  );

  // refs để flush an toàn
  const watchedRef = React.useRef(0);
  const posRef = React.useRef(0);
  React.useEffect(() => {
    watchedRef.current = watched;
  }, [watched]);
  React.useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  const apply = React.useCallback(
    (payload: any) => {
      if (payload?.lessonMeta) setMeta(payload.lessonMeta as LessonMeta);

      if (payload?.lessonProgress) {
        const lp: any = payload.lessonProgress;
        setProgress(lp as LessonProgress);

        // Nếu BE đã gắn cờ vi phạm
        if (lp?.violated_at) {
          setViolated(true);
          try {
            localStorage.removeItem(
              resumeKey(lessonId, payload?.lessonMeta?.youtube_url)
            );
          } catch {}
        }

        setWatched(lp?.watched_seconds ?? 0);
        setPos(lp?.last_position_sec ?? 0);

        // nhận lại số trang PDF đã lưu ở DB (nếu có)
        setPdfCompletedPages(lp?.pdfCompletedPages ?? 0);
        setPdfTotalPages(lp?.pdfTotalPages ?? 0);
        setPdfCurrentPage(lp?.pdfCurrentPage ?? 1);
      }
    },
    [lessonId]
  );

  // Load lần đầu
  React.useEffect(() => {
    if (!lessonId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch(`/lessons/${lessonId}`, { method: "GET" });
        if (!cancelled) {
          apply(r);
          setErr(null);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Lỗi tải bài học");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lessonId, apply]);

  // Nếu đã hoàn thành, xoá resume cho YouTube
  React.useEffect(() => {
    if (progress?.completed && meta?.youtube_url) {
      try {
        localStorage.removeItem(resumeKey(lessonId, meta.youtube_url));
      } catch {}
    }
  }, [progress?.completed, meta?.youtube_url, lessonId]);

  // Đồng bộ định kỳ (15s) – CHỈ khi chưa hoàn thành
  React.useEffect(() => {
    if (loading || violated || progress?.completed || !lessonId) return;

    const isPdfLesson = meta?.type === "pdf";

    const id = setInterval(() => {
      authFetch(`/lessons/${lessonId}/progress`, {
        method: "PATCH",
        body: JSON.stringify({
          watchedSeconds: Math.floor(watchedRef.current),
          lastPositionSec: Math.floor(posRef.current),
          // nếu là PDF thì gửi thêm số trang
          pdfCompletedPages: isPdfLesson ? pdfCompletedPages : undefined,
          pdfTotalPages: isPdfLesson ? pdfTotalPages : undefined,
          pdfCurrentPage: isPdfLesson ? pdfCurrentPage : undefined,
        }),
      }).catch(() => {});
    }, 15000);
    return () => clearInterval(id);
  }, [
    lessonId,
    loading,
    violated,
    progress?.completed,
    meta?.type,
    pdfCompletedPages,
    pdfTotalPages,
    pdfCurrentPage,
  ]);

  // Flush khi ẩn tab/đóng trang
  React.useEffect(() => {
    if (violated || progress?.completed || !lessonId) return;

    const onVis = () => {
      if (document.visibilityState === "hidden") {
        const isPdfLesson = meta?.type === "pdf";
        authFetch(`/lessons/${lessonId}/progress`, {
          method: "PATCH",
          body: JSON.stringify({
            watchedSeconds: Math.floor(watchedRef.current),
            lastPositionSec: Math.floor(posRef.current),
            pdfCompletedPages: isPdfLesson ? pdfCompletedPages : undefined,
            pdfTotalPages: isPdfLesson ? pdfTotalPages : undefined,
            pdfCurrentPage: isPdfLesson ? pdfCurrentPage : undefined,
          }),
        }).catch(() => {});
      }
    };

    const onUnload = () => {
      try {
        const isPdfLesson = meta?.type === "pdf";
        const payload: any = {
          watchedSeconds: Math.floor(watchedRef.current),
          lastPositionSec: Math.floor(posRef.current),
        };
        if (isPdfLesson) {
          payload.pdfCompletedPages = pdfCompletedPages;
          payload.pdfTotalPages = pdfTotalPages;
          payload.pdfCurrentPage = pdfCurrentPage;
        }
        navigator.sendBeacon?.(
          `${process.env.NEXT_PUBLIC_API_BASE}/lessons/${lessonId}/progress`,
          new Blob([JSON.stringify(payload)], { type: "application/json" })
        );
      } catch {}
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [
    lessonId,
    violated,
    progress?.completed,
    meta?.type,
    pdfCompletedPages,
    pdfTotalPages,
    pdfCurrentPage,
  ]);

  // Tick từ viewer (video + PDF)
  const onTick = React.useCallback(
    (delta: number, cur?: number) => {
      if (violated || progress?.completed) return;
      setWatched((s) => s + delta);
      if (typeof cur === "number") {
        setPos(cur);
        try {
          localStorage.setItem(
            resumeKey(lessonId, meta?.youtube_url),
            String(Math.floor(cur))
          );
        } catch {}
      }
    },
    [violated, progress?.completed, lessonId, meta?.youtube_url]
  );

  // Vi phạm (seek/rate) – chỉ áp cho video
  const onViolation = React.useCallback(
    async (kind: "seek" | "rate" | "both", extras?: any) => {
      if (progress?.completed) return;
      setViolated(true);
      try {
        localStorage.removeItem(resumeKey(lessonId, meta?.youtube_url));
      } catch {}
      try {
        await authFetch(`/lessons/${lessonId}/violation`, {
          method: "PATCH",
          body: JSON.stringify({ reason: kind, reset: true, coverage: extras }),
        });
      } catch {}
      setWatched(0);
      setPos(0);
    },
    [lessonId, meta?.youtube_url, progress?.completed]
  );

  // Finalize
  const finalizeIfNeeded = React.useCallback(async () => {
    if (!meta || violated || !lessonId || progress?.completed) return;
    try {
      const r = await authFetch(`/lessons/${lessonId}/finalize`, {
        method: "PATCH",
        body: JSON.stringify({ lastPositionSec: Math.floor(posRef.current) }),
      });
      apply(r);
    } catch {}
  }, [lessonId, meta, violated, apply, progress?.completed]);

  // Build pdfUrl tuyệt đối (ưu tiên meta.pdf_url, fallback /files/:id)
  const pdfAbs = React.useMemo(() => {
    if (!meta) return null;
    if (meta.pdf_url) return toAbs(meta.pdf_url);
    const pdfId = (meta as any).pdf_file_id as string | undefined;
    return pdfId ? toAbs(`/files/${pdfId}`) : null;
  }, [meta]);

  const safePdfUrl = withTokenQ(pdfAbs);

  const isCompleted = !!progress?.completed;
  const isPdf = meta?.type === "pdf";

  // Tính phần trăm và label hiển thị
  let percent = 0;
  let progressLabel = "";

  if (isPdf) {
    const total = pdfTotalPages || 0;
    const completed = Math.min(pdfCompletedPages, total || 0);

    percent =
      total > 0
        ? Math.min(100, (completed / total) * 100)
        : isCompleted
        ? 100
        : 0;

    progressLabel = `Đã xem: ${completed}/${
      total || "?"
    } trang — Tiến độ: ${Math.round(percent)}%`;
  } else {
    const duration = meta?.duration_seconds || 0;
    percent = duration > 0 ? Math.min(100, (watched / duration) * 100) : 0;

    progressLabel = `Đã xem: ${fmt(watched)} / ${fmt(
      duration
    )} — Tiến độ: ${Math.round(percent)}%`;
  }

  if (loading) {
    return (
      <Box sx={{ maxWidth: 960, mx: "auto", mt: 4 }}>
        <Card>
          <CardContent>Đang tải bài học…</CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Card sx={{ maxWidth: 960, mx: "auto", mt: 4, borderRadius: 4 }}>
      <CardContent sx={{ p: 4 }}>
        {meta ? (
          <LessonContentViewer
            type={meta.type as any}
            youtubeUrl={meta.youtube_url ?? null}
            pdfUrl={safePdfUrl}
            durationSeconds={meta.duration_seconds ?? 0}
            resumeFromSeconds={progress?.last_position_sec || 0}
            onValidWatchTick={onTick}
            onViolation={isCompleted ? undefined : onViolation}
            onEnded={isCompleted ? undefined : finalizeIfNeeded}
            disableGuards={isCompleted}
            lessonId={lessonId}
            onPageProgress={handlePageProgress}
            initialPdfCompletedPages={pdfCompletedPages}
            initialPdfTotalPages={pdfTotalPages}
            initialPage={pdfCurrentPage}
          />
        ) : (
          <Alert severity="warning">Không có dữ liệu bài học.</Alert>
        )}

        {/* Info */}
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mr: 1 }}>
            {meta?.title || "Bài học"}
          </Typography>
          {meta?.is_mandatory && <Chip color="error" label="BẮT BUỘC" />}
          {meta && (
            <Chip
              variant="outlined"
              label={`~${Math.ceil((meta.duration_seconds || 0) / 60)} phút`}
            />
          )}
        </Stack>

        {/* Tiến độ: video = phút, pdf = số trang */}
        <Typography sx={{ mt: 1 }}>{progressLabel}</Typography>

        <Box sx={{ mt: 1 }}>
          <LinearProgress variant="determinate" value={percent} />
        </Box>

        {violated ? (
          <Chip
            sx={{ mt: 1 }}
            color="warning"
            label="ĐÃ GẮN CỜ VI PHẠM - F5 HỌC LẠI"
          />
        ) : isCompleted ? (
          <Chip sx={{ mt: 1 }} color="success" label="ĐÃ HOÀN THÀNH" />
        ) : (
          <Chip
            sx={{
              mt: 1,
              background: "#f97316",
              color: "#fff",
            }}
            label="Đang học bài này"
          />
        )}

        {err && (
          <Alert sx={{ mt: 2 }} severity="error">
            {err}
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
