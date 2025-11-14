"use client";

import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import Link from "next/link";

interface LessonRowProps {
  id: string;
  order: number;
  title: string;
  type: string;
  duration_minutes: number | null;
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
  is_required,
  completed,
  unlocked,
}: LessonRowProps) {
  // text hiển thị thời lượng ~X phút (ẩn nếu null)
  const durationText =
    typeof duration_minutes === "number" ? ` · ~${duration_minutes} phút` : "";

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
      {/* LEFT SIDE: tiêu đề + badge */}
      <Box sx={{ flexGrow: 1 }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="flex-start"
          flexWrap="wrap"
          sx={{ mb: 0.5 }}
        >
          {/* Tiêu đề bài học */}
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

          {/* Chip BẮT BUỘC */}
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

          {/* Chip ĐÃ HOÀN THÀNH */}
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

          {/* Trường hợp tương lai: bài bị khoá */}
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

        {/* Info phụ: loại + thời lượng */}
        <Typography
          variant="body2"
          sx={{
            color: "#666",
            fontSize: "0.9rem",
            lineHeight: 1.4,
          }}
        >
          Loại: {type || "N/A"}
          {durationText}
        </Typography>
      </Box>

      {/* RIGHT SIDE: nút hành động */}
      {completed ? (
        // ĐÃ HOÀN THÀNH → vẫn cho xem lại
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
        // CHƯA HOÀN THÀNH + đã mở khoá → Học bài
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
        // CHƯA MỞ KHOÁ → chỉ báo trạng thái
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
