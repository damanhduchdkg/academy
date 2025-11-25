"use client";

import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import Link from "next/link";

interface LessonRowProps {
  id: string;
  order: number;
  title: string;
  type: string;
  // video: phút
  duration_minutes?: number | null;
  // pdf: số trang
  pageCount?: number | null;
  is_required?: boolean;
  completed: boolean;
  unlocked: boolean;
}

export function LessonRow({
  id,
  order,
  title,
  type,
  duration_minutes,
  pageCount,
  is_required,
  completed,
  unlocked,
}: LessonRowProps) {
  const isPdfLike = type === "pdf" || type === "slide";

  // 🔹 ƯU TIÊN: PDF dùng pageCount; nếu không có thì fallback duration_minutes
  const numericBase = (() => {
    if (isPdfLike) {
      if (pageCount !== null && pageCount !== undefined) {
        return Number(pageCount);
      }
      if (duration_minutes !== null && duration_minutes !== undefined) {
        return Number(duration_minutes);
      }
      return NaN;
    }

    // VIDEO / TEXT: chỉ dùng duration_minutes
    if (duration_minutes === null || duration_minutes === undefined) {
      return NaN;
    }
    return Number(duration_minutes);
  })();

  const hasDuration = Number.isFinite(numericBase);
  let durationText = "";
  let pagesText = "";

  if (hasDuration) {
    if (isPdfLike) {
      // PDF / SLIDE: numericBase = số trang
      pagesText = ` · ${numericBase} trang`;
    } else {
      // VIDEO / TEXT: hiển thị phút như cũ
      durationText = ` · ~${numericBase} phút`;
    }
  } else {
    // Không có dữ liệu → chỉ PDF mới hiển thị ? trang
    if (isPdfLike) {
      pagesText = " · ? trang";
    }
  }

  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      alignItems={{ xs: "flex-start", md: "center" }}
      justifyContent="space-between"
      spacing={1.5}
      sx={{
        border: "1px solid #dcdcdc",
        borderRadius: "12px",
        p: 2,
        mb: 2,
        backgroundColor: "#fff",
        boxShadow: "0 20px 40px rgba(0,0,0,0.03), 0 4px 8px rgba(0,0,0,0.04)",
      }}
    >
      <Box sx={{ flexGrow: 1 }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="flex-start"
          flexWrap="wrap"
          sx={{ mb: 0.5 }}
        >
          <Typography
            variant="body1"
            sx={{
              fontWeight: 600,
              color: "#111",
              fontSize: "1rem",
              lineHeight: 1.4,
            }}
          >
            {order}. {title}
          </Typography>

          {is_required && (
            <Chip
              label="BẮT BUỘC"
              size="small"
              sx={{
                backgroundColor: "#c00000",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.7rem",
                height: "24px",
                borderRadius: "999px",
                px: 1,
              }}
            />
          )}

          {completed && (
            <Chip
              label="✔ Đã hoàn thành"
              size="small"
              sx={{
                backgroundColor: "#1e7a32",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.7rem",
                height: "24px",
                borderRadius: "999px",
                px: 1,
              }}
            />
          )}

          {!completed && !unlocked && (
            <Chip
              label="Khoá / Chưa mở"
              size="small"
              sx={{
                backgroundColor: "#999",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.7rem",
                height: "24px",
                borderRadius: "999px",
                px: 1,
              }}
            />
          )}
        </Stack>

        {/* PDF → hiển thị số trang, VIDEO → hiển thị phút */}
        <Typography
          variant="body2"
          sx={{ color: "#666", fontSize: "0.9rem", lineHeight: 1.4 }}
        >
          Loại: {type || "N/A"}
          {isPdfLike ? pagesText : durationText}
        </Typography>
      </Box>

      {/* phần nút giữ nguyên */}
      {completed ? (
        <Button
          component={Link}
          href={`/lessons/${id}`}
          variant="contained"
          sx={{
            backgroundColor: "#1e7a32",
            fontWeight: 600,
            borderRadius: "12px",
            px: 2.5,
            py: 1,
            textTransform: "none",
            fontSize: "0.95rem",
            boxShadow:
              "0 16px 32px rgba(30,122,50,0.25), 0 4px 8px rgba(0,0,0,0.08)",
            "&:hover": {
              backgroundColor: "#165723",
            },
          }}
        >
          Xem lại
        </Button>
      ) : unlocked ? (
        <Button
          component={Link}
          href={`/lessons/${id}`}
          variant="contained"
          sx={{
            backgroundColor: "#c00000",
            fontWeight: 600,
            borderRadius: "12px",
            px: 2.5,
            py: 1,
            textTransform: "none",
            fontSize: "0.95rem",
            boxShadow:
              "0 16px 32px rgba(192,0,0,0.3), 0 4px 8px rgba(0,0,0,0.08)",
            "&:hover": {
              backgroundColor: "#8f0000",
            },
          }}
        >
          Học bài
        </Button>
      ) : (
        <Chip
          label="Chưa mở khoá"
          sx={{
            backgroundColor: "#999",
            color: "#fff",
            fontWeight: 600,
            fontSize: "0.8rem",
            height: "32px",
            borderRadius: "12px",
            px: 1.5,
          }}
        />
      )}
    </Stack>
  );
}
