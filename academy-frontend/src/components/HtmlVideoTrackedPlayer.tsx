// src/components/HtmlVideoTrackedPlayer.tsx
"use client";

import React, { useEffect, useRef } from "react";
import type { OnTick, OnViolation } from "./YouTubeTrackedPlayer";

type Props = {
  videoUrl: string; // có thể là /files/xxx hoặc full URL
  durationSeconds?: number | null;
  resumeFromSeconds?: number;
  onValidWatchTick?: OnTick;
  onViolation?: OnViolation; // tạm thời không dùng, nhưng giữ cho đồng bộ type
  onEnded?: () => void;
  disableGuards?: boolean; // hiện tại HTML video chưa chặn tua, nhưng giữ prop để không phá API
};

const API_BASE = process.env.NEXT_PUBLIC_API ?? "http://localhost:3000";

export default function HtmlVideoTrackedPlayer({
  videoUrl,
  durationSeconds,
  resumeFromSeconds = 0,
  onValidWatchTick,
  onViolation, // eslint-disable-line @typescript-eslint/no-unused-vars
  onEnded,
  disableGuards, // eslint-disable-line @typescript-eslint/no-unused-vars
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastReportedRef = useRef<number>(0);

  // Chuẩn hoá URL: nếu BE trả "/files/xxx" thì prefix domain API
  const src =
    videoUrl.startsWith("http://") || videoUrl.startsWith("https://")
      ? videoUrl
      : `${API_BASE}${videoUrl}`;

  // Resume từ vị trí đã xem
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (resumeFromSeconds && resumeFromSeconds > 0) {
      // đợi metadata load xong rồi mới seek
      const handler = () => {
        try {
          v.currentTime = resumeFromSeconds;
        } catch {
          /* ignore */
        }
      };
      v.addEventListener("loadedmetadata", handler, { once: true });
      return () => v.removeEventListener("loadedmetadata", handler);
    }
  }, [resumeFromSeconds]);

  // Tick đơn giản mỗi lần timeupdate
  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v || !onValidWatchTick) return;

    const pos = Math.floor(v.currentTime || 0);
    if (pos === lastReportedRef.current) return;
    lastReportedRef.current = pos;

    // cast any để không bị lệch kiểu với OnTick hiện tại
    (onValidWatchTick as any)({
      positionSec: pos,
      durationSec: durationSeconds ?? Math.floor(v.duration || 0),
      source: "html-video",
    });
  }

  function handleEnded() {
    lastReportedRef.current = 0;
    onEnded?.();
  }

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: "hidden",
        background: "#000",
      }}
    >
      <video
        ref={videoRef}
        src={src}
        style={{ width: "100%", height: "100%", maxHeight: "80vh" }}
        controls
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
      />
    </div>
  );
}
