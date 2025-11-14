"use client";

import React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Worker PDF
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export type OnTick = (
  deltaSeconds: number,
  currentVirtualSeconds?: number
) => void;

type PageProgressInfo = {
  completedPages: number;
  totalPages: number;
  currentPage: number;
};

type Props = {
  pdfUrl: string;
  /** Số giây tối thiểu mỗi trang */
  minSecondsPerPage?: number;

  // Giữ cho tương thích, không dùng nhiều
  totalSeconds?: number;
  resumeFromSeconds?: number;

  onValidWatchTick?: OnTick;
  onEnded?: () => void;

  /** Bài đã hoàn thành → không chặn, không đếm thời gian */
  disableGuards?: boolean;

  /** Giữ cho tương thích, hiện tại không dùng (DB lo phần resume) */
  lessonId?: string;

  /** Báo ra ngoài số trang đã hoàn thành / tổng trang / trang hiện tại */
  onPageProgress?: (info: PageProgressInfo) => void;

  /** Giá trị khởi tạo đọc từ DB */
  initialCompletedPages?: number;
  initialTotalPages?: number;
  initialPage?: number;
};

/* ====== Vòng tròn đếm thời gian ====== */
function CircleTimer({
  secondsDone,
  totalSeconds,
}: {
  secondsDone: number;
  totalSeconds: number;
}) {
  const progress = Math.min(1, secondsDone / totalSeconds);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const remain = Math.max(0, totalSeconds - secondsDone);

  return (
    <div
      style={{
        width: 46,
        height: 46,
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox="0 0 40 40"
        style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}
      >
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="4"
        />
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="none"
          stroke="#22c55e"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        style={{
          position: "absolute",
          fontSize: 10,
          fontWeight: 600,
          color: "#111827",
          transform: "rotate(0deg)",
        }}
      >
        {remain > 0 ? `${remain}s` : "OK"}
      </span>
    </div>
  );
}

export default function PdfTrackedViewer({
  pdfUrl,
  minSecondsPerPage = 30,
  onValidWatchTick,
  onEnded,
  disableGuards = false,
  lessonId, // hiện tại không dùng, để tương thích
  onPageProgress,
  initialCompletedPages,
  initialTotalPages,
  initialPage,
}: Props) {
  const [numPages, setNumPages] = React.useState<number | null>(null);
  const [pageNumber, setPageNumber] = React.useState(1);

  // watchedSeconds[page] = số giây đã xem của trang đó
  const [watchedSeconds, setWatchedSeconds] = React.useState<
    Record<number, number>
  >({});
  const timerRef = React.useRef<number | null>(null);
  const lastTickRef = React.useRef<number>(0);
  const isActiveRef = React.useRef<boolean>(true);
  const completedOnceRef = React.useRef(false);

  const [warning, setWarning] = React.useState<string | null>(null);

  const virtualTotalSeconds = React.useMemo(
    () => Object.values(watchedSeconds).reduce((sum, s) => sum + s, 0),
    [watchedSeconds]
  );

  const isPageCompleted = React.useCallback(
    (p: number) => (watchedSeconds[p] || 0) >= minSecondsPerPage,
    [watchedSeconds, minSecondsPerPage]
  );

  const completedPagesCount = React.useMemo(
    () =>
      Object.values(watchedSeconds).filter((s) => s >= minSecondsPerPage)
        .length,
    [watchedSeconds, minSecondsPerPage]
  );

  const canGoToPage = React.useCallback(
    (target: number) => {
      if (!numPages) return false;
      if (target < 1 || target > numPages) return false;

      // Bài đã hoàn thành → cho nhảy tự do
      if (disableGuards) return true;

      // được quay lại
      if (target <= pageNumber) return true;

      // sang trang sau khi trang hiện tại đủ thời gian
      if (target === pageNumber + 1 && isPageCompleted(pageNumber)) return true;

      return false;
    },
    [numPages, pageNumber, isPageCompleted, disableGuards]
  );

  const goToPage = React.useCallback(
    (target: number) => {
      if (!canGoToPage(target)) {
        if (!disableGuards) {
          setWarning(
            `Bạn phải học đủ thời gian ở trang ${pageNumber} trước khi sang trang mới.`
          );
        }
        return;
      }
      setPageNumber(target);
    },
    [canGoToPage, pageNumber, disableGuards]
  );

  /** Timer cộng thời gian cho trang hiện tại */
  const startTimer = React.useCallback(() => {
    // Bài đã hoàn thành → không cần đếm thời gian nữa
    if (disableGuards) return;
    if (timerRef.current) return;

    lastTickRef.current = performance.now();
    timerRef.current = window.setInterval(() => {
      if (!isActiveRef.current) return;

      const now = performance.now();
      const delta = Math.max(0, Math.floor((now - lastTickRef.current) / 1000));
      if (delta <= 0) return;
      lastTickRef.current = now;

      setWatchedSeconds((prev) => {
        const cur = prev[pageNumber] || 0;
        const updated = { ...prev, [pageNumber]: cur + delta };

        // tick ra ngoài (để BE vẫn nhận watchedSeconds nếu cần)
        try {
          onValidWatchTick?.(delta, virtualTotalSeconds + delta);
        } catch {}

        // check hoàn thành toàn bộ 1 lần
        if (numPages && !completedOnceRef.current) {
          const doneCount = Object.values(updated).filter(
            (s) => s >= minSecondsPerPage
          ).length;
          if (doneCount >= numPages) {
            completedOnceRef.current = true;
            try {
              onEnded?.();
            } catch {}
          }
        }

        return updated;
      });
    }, 1000) as unknown as number;
  }, [
    pageNumber,
    onValidWatchTick,
    onEnded,
    numPages,
    minSecondsPerPage,
    virtualTotalSeconds,
    disableGuards,
  ]);

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // visibility tab
  React.useEffect(() => {
    const onVis = () => {
      isActiveRef.current = document.visibilityState === "visible";
      if (isActiveRef.current) startTimer();
      else stopTimer();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [startTimer, stopTimer]);

  // intersection viewport
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

  // mount/unmount
  React.useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [startTimer, stopTimer]);

  const onDocumentLoadSuccess = React.useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n);
    },
    []
  );

  // ====== HYDRATE từ DB: initialCompletedPages / initialTotalPages / initialPage ======
  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (hydratedRef.current) return;

    const initTotal = initialTotalPages ?? 0;
    const initCompleted = initialCompletedPages ?? 0;
    const initPage = initialPage ?? 0;

    if (!initTotal && !initCompleted && !initPage) return;

    hydratedRef.current = true;

    // tổng trang
    if (initTotal > 0) {
      setNumPages((prev) => prev || initTotal);
    }

    // trang đang xem
    if (initPage > 0) {
      setPageNumber(initPage);
    }

    // đánh dấu các trang đã hoàn thành
    if (initCompleted > 0) {
      setWatchedSeconds((prev) => {
        const next = { ...prev };
        for (let p = 1; p <= initCompleted; p++) {
          const cur = next[p] || 0;
          if (cur < minSecondsPerPage) {
            next[p] = minSecondsPerPage;
          }
        }
        return next;
      });
    }

    if (onPageProgress) {
      onPageProgress({
        completedPages: initCompleted,
        totalPages: initTotal || numPages || 0,
        currentPage: initPage > 0 ? initPage : 1,
      });
    }
  }, [
    initialCompletedPages,
    initialTotalPages,
    initialPage,
    minSecondsPerPage,
    onPageProgress,
    numPages,
  ]);

  // auto ẩn popup sau 3s
  React.useEffect(() => {
    if (!warning) return;
    const t = setTimeout(() => setWarning(null), 3000);
    return () => clearTimeout(t);
  }, [warning]);

  const currentPageSeconds = watchedSeconds[pageNumber] || 0;

  // ====== Báo tiến độ ra ngoài (số trang hoàn thành / tổng trang / trang hiện tại) ======
  React.useEffect(() => {
    if (!onPageProgress) return;
    const total = numPages || 0;

    // Nếu bài đã hoàn thành → xem như đã xong tất cả trang
    const completed = disableGuards
      ? total
      : Math.min(completedPagesCount, total);

    onPageProgress({
      completedPages: completed,
      totalPages: total,
      currentPage: pageNumber,
    });
  }, [
    completedPagesCount,
    numPages,
    disableGuards,
    pageNumber,
    onPageProgress,
  ]);

  return (
    <div ref={holderRef} style={{ width: "100%", position: "relative" }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "80vh",
          borderRadius: 12,
          overflow: "auto",
          background: "#111827",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          loading="Đang tải PDF..."
        >
          <Page
            pageNumber={pageNumber}
            width={800}
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        </Document>
      </div>

      {/* Footer điều hướng + tiến độ */}
      <div
        style={{
          marginTop: 8,
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 14,
        }}
      >
        <button
          onClick={() => goToPage(pageNumber - 1)}
          disabled={pageNumber <= 1}
          style={{ padding: "4px 10px" }}
        >
          Trang trước
        </button>

        <span>
          Trang {pageNumber} / {numPages || "?"}
        </span>

        {/* Vòng tròn đếm cho trang hiện tại – tắt khi đã hoàn thành */}
        {!disableGuards ? (
          !isPageCompleted(pageNumber) ? (
            <CircleTimer
              secondsDone={currentPageSeconds}
              totalSeconds={minSecondsPerPage}
            />
          ) : (
            <span style={{ color: "#16a34a", fontWeight: 500 }}>
              Đã đủ thời gian
            </span>
          )
        ) : (
          <span style={{ color: "#6b7280", fontWeight: 500 }}>
            Đang xem lại (không tính thời gian)
          </span>
        )}

        {/* Nút Trang sau */}
        {numPages && pageNumber < numPages && (
          <button
            onClick={() => goToPage(pageNumber + 1)}
            style={{ padding: "4px 10px", marginLeft: 8 }}
          >
            Trang sau
          </button>
        )}

        <span style={{ marginLeft: "auto" }}>
          Hoàn thành:{" "}
          {disableGuards && numPages
            ? `${numPages}/${numPages}`
            : `${completedPagesCount}/${numPages || "?"}`}{" "}
          trang
        </span>
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
        {!disableGuards ? (
          <>
            • Mỗi trang cần xem tối thiểu {minSecondsPerPage} giây mới được tính
            hoàn thành.
            {"\n"}• Bạn chỉ có thể sang trang kế tiếp khi trang hiện tại đã đủ
            thời gian.
          </>
        ) : (
          <>
            • Bài đã hoàn thành – bạn có thể xem lại các trang một cách tự do.
          </>
        )}
      </div>

      {/* Popup cảnh báo */}
      {warning && !disableGuards && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1300,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              padding: "20px 24px",
              borderRadius: 16,
              maxWidth: 420,
              width: "90%",
              boxShadow:
                "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 16,
                marginBottom: 8,
                color: "#ee3b00",
              }}
            >
              Thông báo
            </div>
            <div style={{ fontSize: 14, color: "#4b5563", marginBottom: 16 }}>
              {warning}
            </div>
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button
                onClick={() => setWarning(null)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "none",
                  background: "#00a3cb",
                  color: "#fff",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
