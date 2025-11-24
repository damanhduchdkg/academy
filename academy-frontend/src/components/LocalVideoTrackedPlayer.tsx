"use client";

import { useEffect, useRef } from "react";
import type { OnTick, OnViolation } from "./YouTubeTrackedPlayer";

type Props = {
  src: string;
  durationSeconds?: number | null;
  resumeFromSeconds?: number;
  onValidWatchTick?: OnTick;
  onViolation?: OnViolation;
  onEnded?: () => void;
  disableGuards?: boolean;
};

const SEEK_THRESHOLD_SEC = 2; // nhảy > 2s mới coi là tua nhanh

export default function LocalVideoTrackedPlayer({
  src,
  durationSeconds,
  resumeFromSeconds = 0,
  onValidWatchTick,
  onViolation,
  onEnded,
  disableGuards = false,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastReportedRef = useRef(0);
  const firstTickRef = useRef(true); // 👈 để phân biệt tick đầu (sau resume)

  /* =========================
      Resume vị trí xem
  ========================= */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    if (resumeFromSeconds && resumeFromSeconds > 0) {
      const setTime = () => {
        try {
          v.currentTime = resumeFromSeconds;
        } catch {}
      };
      if (v.readyState >= 1) setTime();
      else v.addEventListener("loadedmetadata", setTime, { once: true });
    }
  }, [resumeFromSeconds]);

  /* =========================
      Phát hiện đổi tốc độ (ratechange)
  ========================= */
  useEffect(() => {
    if (disableGuards) return;
    const v = videoRef.current;
    if (!v || !onViolation) return;

    const handler = () => {
      if (v.playbackRate !== 1) {
        onViolation("rate", { rate: v.playbackRate });
        v.playbackRate = 1; // bắt về 1x
      }
    };

    v.addEventListener("ratechange", handler);
    return () => v.removeEventListener("ratechange", handler);
  }, [disableGuards, onViolation]);

  /* =========================
      Tick tính tiến độ + detect seek
  ========================= */
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;

    const cur = v.currentTime || 0;
    const prev = lastReportedRef.current;

    // Tick đầu tiên sau khi load / resume:
    // chỉ set baseline, tuyệt đối KHÔNG check vi phạm
    if (firstTickRef.current) {
      firstTickRef.current = false;
      lastReportedRef.current = cur;
      return;
    }

    // --- detect tua nhanh ---
    if (!disableGuards && onViolation && cur - prev > SEEK_THRESHOLD_SEC) {
      onViolation("seek", { from: prev, to: cur, delta: cur - prev });
      lastReportedRef.current = cur;
      // để BE reset & gắn cờ, FE không cộng tiến độ nữa
      return;
    }

    if (!onValidWatchTick || disableGuards) {
      lastReportedRef.current = cur;
      return;
    }

    const delta = cur - prev;
    if (delta <= 0) {
      lastReportedRef.current = cur;
      return;
    }

    lastReportedRef.current = cur;

    try {
      // giống format YouTube: (deltaSeconds, currentPos)
      onValidWatchTick(delta, cur);
    } catch (e) {
      console.error("onValidWatchTick error", e);
    }
  };

  const handleEnded = () => {
    if (!disableGuards && onEnded) onEnded();
  };

  return (
    <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto" }}>
      <video
        ref={videoRef}
        src={src}
        controls
        playsInline
        style={{
          width: "100%",
          maxHeight: "70vh",
          borderRadius: 12,
          backgroundColor: "#000",
        }}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      >
        Trình duyệt của bạn không hỗ trợ video HTML5.
      </video>

      <div
        style={{
          marginTop: 10,
          background: "rgba(0,0,0,.06)",
          color: "#374151",
          padding: "10px 12px",
          borderRadius: 10,
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: "pre-line",
        }}
      >
        {`• Video MP4 nội bộ tuân theo luật học: chỉ tính khi xem bình thường.\n• Tua nhanh hoặc chỉnh tốc độ sẽ bị gắn cờ vi phạm.`}
      </div>
    </div>
  );
}
