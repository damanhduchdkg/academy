"use client";

import React from "react";

export type OnTick = (deltaSeconds: number, currentPos?: number) => void;

type Props = {
  /** URL tuyệt đối tới BE, ví dụ: http://192.168.0.113:3000/files/<id> */
  pdfUrl: string;
  /** Thời lượng ảo cho PDF (nếu muốn). Bỏ trống = tính đúng thời gian xem thực tế */
  totalSeconds?: number;
  /** Vị trí resume (giây) cho bộ đếm ảo */
  resumeFromSeconds?: number;
  onValidWatchTick?: OnTick;
  onEnded?: () => void;
};

export default function PdfTrackedViewer({
  pdfUrl,
  totalSeconds,
  resumeFromSeconds = 0,
  onValidWatchTick,
  onEnded,
}: Props) {
  // tiến trình (giây) khi xem PDF
  const curRef = React.useRef<number>(
    Math.max(0, Math.floor(resumeFromSeconds))
  );
  const lastTickRef = React.useRef<number>(0);
  const timerRef = React.useRef<number | null>(null);
  const isActiveRef = React.useRef<boolean>(true); // tab active & iframe trong viewport

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = React.useCallback(() => {
    if (timerRef.current) return;
    lastTickRef.current = performance.now();
    timerRef.current = window.setInterval(() => {
      if (!isActiveRef.current) return;

      const now = performance.now();
      const delta = Math.max(0, Math.floor((now - lastTickRef.current) / 1000));
      if (delta <= 0) return;

      lastTickRef.current = now;
      curRef.current += delta;

      try {
        onValidWatchTick?.(delta, curRef.current);
      } catch {}

      if (typeof totalSeconds === "number" && totalSeconds > 0) {
        if (curRef.current >= totalSeconds) {
          stopTimer();
          try {
            onEnded?.();
          } catch {}
        }
      }
    }, 1000) as unknown as number;
  }, [onValidWatchTick, onEnded, totalSeconds, stopTimer]);

  // quản lý visibility tab
  React.useEffect(() => {
    const onVis = () => {
      isActiveRef.current = document.visibilityState === "visible";
      if (isActiveRef.current) startTimer();
      else stopTimer();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [startTimer, stopTimer]);

  // intersection (iframe nằm trong viewport thì mới tính)
  const holderRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!holderRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting);
        isActiveRef.current = visible && document.visibilityState === "visible";
        if (isActiveRef.current) startTimer();
        else stopTimer();
      },
      { threshold: 0.25 }
    );
    io.observe(holderRef.current);
    return () => io.disconnect();
  }, [startTimer, stopTimer]);

  // mount → bắt đầu đếm
  React.useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [startTimer, stopTimer]);

  // NHÚNG PDF: dùng <iframe> thuần, KHÔNG sandbox (tránh Chrome block)
  const src = pdfUrl; // phải là URL tuyệt đối tới BE

  return (
    <div ref={holderRef} style={{ width: "100%" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "80vh",
          borderRadius: 12,
          overflow: "hidden",
          background: "#f5f5f5",
        }}
      >
        <iframe
          key={src} // tránh giữ cache iframe cũ
          src={src}
          title="PDF"
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="fullscreen"
          referrerPolicy="no-referrer"
          loading="eager"
          // CHÚ Ý: KHÔNG có thuộc tính sandbox ở đây
        />
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
        {totalSeconds
          ? `• PDF được tính thời gian học tổng ~${Math.ceil(
              totalSeconds / 60
            )} phút.\n• Chỉ tính khi tab đang mở và nội dung đang hiển thị.`
          : `• PDF được tính theo thời gian xem thực tế.\n• Chỉ tính khi tab đang mở và nội dung đang hiển thị.`}
      </div>
    </div>
  );
}
