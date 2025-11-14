"use client";
import React from "react";

/** ====== Public props ====== */
export type OnTick = (deltaSeconds: number, currentPos?: number) => void;
export type OnViolation = (
  kind: "seek" | "rate" | "both",
  extras?: any
) => void;

export interface YouTubeTrackedPlayerProps {
  youtubeUrl: string;

  /** Thời lượng ước tính của video (FE đang truyền xuống).
   *  Hiện tại component chưa dùng tới, nhưng khai báo để tránh lỗi type,
   *  và có thể dùng sau này nếu cần. */
  durationSeconds?: number;

  resumeFromSeconds?: number;
  onValidWatchTick?: OnTick;
  onViolation?: OnViolation;
  onEnded?: () => void;

  /** Khi true (bài đã hoàn thành), KHÔNG chặn và KHÔNG đếm tiến trình */
  disableGuards?: boolean;

  /** tuỳ chọn, để đồng bộ key resume theo lessonId */
  storageNamespace?: string;
}

/** ====== YouTube states ====== */
const YT_STATE_UNSTARTED = -1;
const YT_STATE_ENDED = 0;
const YT_STATE_PLAYING = 1;
const YT_STATE_PAUSED = 2;
const YT_STATE_BUFFERING = 3;
const YT_STATE_CUED = 5;

/** ====== Policies ====== */
const MAX_FORWARD_SKIP = 2; // > 5s coi là tua nhanh
const JITTER = 1.25;
const RATE_TOL = 0.01;

/** ====== Helpers ====== */
function extractVid(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace("/", "");
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

// (tuỳ chọn) tạo resume key nếu muốn lưu/đọc localStorage ở đây
function makeResumeKey(ns?: string, url?: string) {
  if (!ns || !url) return null;
  const v = extractVid(url);
  return v ? `yt_resume_${ns}_${v}` : null;
}

let ytReadyPromise: Promise<any> | null = null;
function loadYT(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject("SSR");
  const w = window as any;
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (ytReadyPromise) return ytReadyPromise;

  ytReadyPromise = new Promise((resolve) => {
    if (!document.getElementById("yt-iframe-api")) {
      const s = document.createElement("script");
      s.id = "yt-iframe-api";
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      document.head.appendChild(s);
    }
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      try {
        prev && prev();
      } catch {}
      resolve(w.YT);
    };
    const check = () => (w.YT?.Player ? resolve(w.YT) : setTimeout(check, 200));
    check();
  });
  return ytReadyPromise;
}

/** ====== Component ====== */
export default function YouTubeTrackedPlayer({
  youtubeUrl,
  durationSeconds, // hiện chưa dùng, chỉ để khớp props
  resumeFromSeconds = 0,
  onValidWatchTick,
  onViolation,
  onEnded,
  disableGuards = false,
  storageNamespace,
}: YouTubeTrackedPlayerProps) {
  const holderRef = React.useRef<HTMLDivElement | null>(null);
  const playerRef = React.useRef<any | null>(null);

  // baseline tick theo wall-clock
  const lastCurRef = React.useRef(0);
  const lastNowRef = React.useRef(0);
  const lastRateRef = React.useRef(1);

  // track state & vi phạm
  const lastStateRef = React.useRef<number | null>(null);
  const violatedRef = React.useRef(false);

  // neo khi đang PAUSE để phát hiện kéo seek trong PAUSE
  const pausedAnchorRef = React.useRef<number | null>(null);

  const rafId = React.useRef<number | null>(null);

  // (optional) lưu resume local mỗi ~12s nếu muốn
  const resumeKeyRef = React.useRef<string | null>(null);
  const lastSaveTS = React.useRef(0);

  const setBaseline = React.useCallback((cur: number, rate = 1) => {
    lastCurRef.current = cur;
    lastNowRef.current = performance.now();
    lastRateRef.current = rate || 1;
  }, []);

  const maybeSaveResume = React.useCallback((pos: number) => {
    const key = resumeKeyRef.current;
    if (!key) return;
    const now = performance.now();
    if (now - lastSaveTS.current < 12000) return;
    lastSaveTS.current = now;
    try {
      localStorage.setItem(key, String(Math.floor(pos)));
    } catch {}
  }, []);

  const signalViolation = React.useCallback(
    (kind: "seek" | "rate" | "both", extras?: any) => {
      if (disableGuards) return; // bài đã hoàn thành → không chặn
      if (violatedRef.current) return;
      violatedRef.current = true;
      try {
        onViolation?.(kind, extras || {});
      } catch {}
    },
    [onViolation, disableGuards]
  );

  const loop = React.useCallback(() => {
    const p = playerRef.current;
    if (!p) return;

    const state = p.getPlayerState?.();
    const cur = p.getCurrentTime?.() || 0;
    const rate = p.getPlaybackRate?.() || 1;

    // --- Khi PAUSED: giám sát kéo seek tiến ngay lập tức ---
    if (state === YT_STATE_PAUSED) {
      if (pausedAnchorRef.current === null) {
        pausedAnchorRef.current = cur; // lần đầu pause, neo lại vị trí
      } else {
        const forward = cur - pausedAnchorRef.current;
        if (forward > MAX_FORWARD_SKIP + JITTER) {
          signalViolation("seek", {
            when: "paused-drag",
            from: pausedAnchorRef.current,
            to: cur,
            delta: forward,
          });
          // parent/BE sẽ reset; không cần đổi baseline
          return;
        }
        // kéo lùi không cộng tiến độ (allow)
      }
      // không tick khi pause
      lastNowRef.current = performance.now();
    }

    // --- Khi PLAYING: tick & chặn đổi tốc độ ---
    if (state === YT_STATE_PLAYING) {
      // reset neo pause (vì đã resume)
      pausedAnchorRef.current = null;

      // chặn tốc độ ≠ 1x
      if (Math.abs(rate - 1) > RATE_TOL) {
        signalViolation("rate", { rate, at: cur });
        return;
      }

      // nếu disableGuards: không đếm tiến trình, chỉ duy trì baseline mượt
      if (disableGuards) {
        setBaseline(cur, 1);
      } else {
        const wall = (performance.now() - lastNowRef.current) / 1000;
        const delta = Math.max(0, Math.min(cur - lastCurRef.current, wall));
        if (delta > 0) {
          try {
            onValidWatchTick?.(delta, cur);
          } catch {}
          maybeSaveResume(cur);
          setBaseline(cur, 1);
        } else {
          if (cur < lastCurRef.current - JITTER) setBaseline(cur, 1);
        }
      }
    }

    // --- Khi ENDED: báo parent finalize ---
    if (state === YT_STATE_ENDED) {
      try {
        onEnded?.();
      } catch {}
      return;
    }

    rafId.current = requestAnimationFrame(loop);
  }, [
    onEnded,
    onValidWatchTick,
    setBaseline,
    signalViolation,
    disableGuards,
    maybeSaveResume,
  ]);

  React.useEffect(() => {
    resumeKeyRef.current = makeResumeKey(storageNamespace, youtubeUrl);
  }, [storageNamespace, youtubeUrl]);

  React.useEffect(() => {
    let destroyed = false;

    loadYT().then((YT: any) => {
      if (destroyed || !holderRef.current) return;
      const vid = extractVid(youtubeUrl) || "";

      playerRef.current = new YT.Player(holderRef.current, {
        videoId: vid,
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          controls: 1,
          autoplay: 0,
        },
        events: {
          onReady: (e: any) => {
            const start = Math.max(0, Math.floor(resumeFromSeconds || 0));
            if (start > 0) {
              try {
                e.target.seekTo(start, true);
              } catch {}
            }
            setBaseline(e.target.getCurrentTime?.() || start, 1);
            violatedRef.current = false;
            pausedAnchorRef.current = null;
            rafId.current = requestAnimationFrame(loop);
          },

          onStateChange: (ev: any) => {
            lastStateRef.current = ev?.data;

            if (ev?.data === YT_STATE_PAUSED) {
              // neo lại để theo dõi kéo seek trong PAUSE
              const cur = playerRef.current?.getCurrentTime?.() || 0;
              pausedAnchorRef.current = cur;
              lastNowRef.current = performance.now();
            }

            if (ev?.data === YT_STATE_PLAYING) {
              const cur = playerRef.current?.getCurrentTime?.() || 0;

              // Nếu vừa từ non-playing → PLAYING: kiểm tra jump (chặn seek khi resume)
              const jump = cur - lastCurRef.current;
              if (!disableGuards && jump > MAX_FORWARD_SKIP + JITTER) {
                signalViolation("seek", {
                  when: "resume-playing",
                  from: lastCurRef.current,
                  to: cur,
                  delta: jump,
                });
                return;
              }

              pausedAnchorRef.current = null;
              setBaseline(cur, playerRef.current?.getPlaybackRate?.() || 1);
            }

            if (ev?.data === YT_STATE_ENDED) {
              try {
                onEnded?.();
              } catch {}
            }
          },
        },
      });
    });

    // rời tab: tạm dừng (không tính tiến trình)
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        try {
          playerRef.current?.pauseVideo?.();
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      destroyed = true;
      document.removeEventListener("visibilitychange", onVis);
      if (rafId.current) cancelAnimationFrame(rafId.current);
      try {
        playerRef.current?.destroy?.();
      } catch {}
      playerRef.current = null;
    };
  }, [youtubeUrl, resumeFromSeconds, loop, setBaseline, disableGuards]);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ position: "relative", width: "100%", aspectRatio: "16/9" }}>
        <div ref={holderRef} style={{ width: "100%", height: "100%" }} />
      </div>

      <div
        style={{
          marginTop: 10,
          background: "rgba(0,0,0,.06)",
          color: "#1f2937",
          padding: "10px 12px",
          borderRadius: 10,
          fontSize: 13,
          lineHeight: 1.5,
          whiteSpace: "pre-line",
        }}
      >
        {
          "• Chỉ tính thời gian khi xem 1x.\n• Không được tua video khi đang học (kể cả lúc đang tạm dừng).\n• Rời tab/ứng dụng: video tạm dừng (không tính tiến trình)."
        }
      </div>
    </div>
  );
}
