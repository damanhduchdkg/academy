"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Box,
  Alert,
  CircularProgress,
  LinearProgress,
} from "@mui/material";
import { LessonRow } from "@/components/LessonRow";
import { authFetch } from "@/lib/authFetch";

/** ===== Types khớp BE ===== */
interface Lesson {
  id: string;
  order: number;
  title: string;
  type: string;
  duration_minutes: number | null;
  is_required: boolean;
  user_progress: {
    completed: boolean;
    unlocked: boolean;
  };
}

interface CourseDetail {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  is_required: boolean;
  lessons: Lesson[];
  courseProgress: {
    completion_percent: number;
    is_completed: boolean;
  };
}

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const courseId = id;
  const router = useRouter();

  const [course, setCourse] = React.useState<CourseDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      // Không có id trên URL
      if (!courseId) {
        setErr("Thiếu courseId trên URL");
        setLoading(false);
        return;
      }

      // Chưa đăng nhập → đá về login (tránh tạo preflight thừa)
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("accessToken")
          : null;
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const data: CourseDetail = await authFetch(`/courses/${courseId}`, {
          method: "GET",
          timeoutMs: 12000,
          retries: 1,
        });
        if (!cancelled) {
          setCourse(data);
          setErr(null);
        }
      } catch (e: any) {
        if (cancelled) return;

        const msg = String(e?.message || "");
        if (msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
          // Hết phiên / token sai
          router.push("/login");
          return;
        }

        // Non-JSON / CORS / timeout / 5xx …
        setErr(
          msg.startsWith("Server trả về non-JSON")
            ? "Máy chủ trả về HTML (có thể do proxy/CORS). Kiểm tra cấu hình API."
            : msg || "Lỗi kết nối server"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId, router]);

  // Loading
  if (loading) {
    return (
      <Box
        sx={{ maxWidth: 1280, mx: "auto", mt: 4, px: 2, textAlign: "center" }}
      >
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Đang tải...
        </Typography>
      </Box>
    );
  }

  // Lỗi
  if (err) {
    return (
      <Box sx={{ maxWidth: 1280, mx: "auto", mt: 4, px: 2 }}>
        <Alert severity="error" sx={{ fontSize: "1rem" }}>
          {err}
        </Alert>
      </Box>
    );
  }

  // Không có dữ liệu
  if (!course) {
    return (
      <Box sx={{ maxWidth: 1280, mx: "auto", mt: 4, px: 2 }}>
        <Alert severity="warning" sx={{ fontSize: "1rem" }}>
          Không thấy khoá học
        </Alert>
      </Box>
    );
  }

  // Ép phần trăm an toàn
  const rawPercent = course.courseProgress?.completion_percent ?? 0;
  const percentNum =
    typeof rawPercent === "number"
      ? rawPercent
      : parseFloat(String(rawPercent)) || 0;
  const percentDisplay = Math.max(0, Math.min(100, Math.round(percentNum)));

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", mt: 4, px: 2, pb: 6 }}>
      {/* Thông tin khoá */}
      <Card
        sx={{
          mb: 3,
          borderRadius: "16px",
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "flex-start" }}
          >
            <Stack spacing={1.5}>
              {/* Category + Required chip */}
              <Stack
                direction="row"
                flexWrap="wrap"
                spacing={1}
                alignItems="center"
              >
                <Chip
                  size="small"
                  label={course.category || "Khác"}
                  sx={{
                    backgroundColor: "#eee",
                    fontSize: "0.7rem",
                    fontWeight: 500,
                    color: "#444",
                    borderRadius: "999px",
                    height: 28,
                  }}
                />

                {course.is_required && (
                  <Chip
                    size="small"
                    label="Khoá bắt buộc"
                    sx={{
                      backgroundColor: "#d00000",
                      color: "#fff",
                      fontWeight: 600,
                      fontSize: "0.7rem",
                      height: "28px",
                      borderRadius: "999px",
                      px: 1,
                    }}
                  />
                )}
              </Stack>

              {/* Course title */}
              <Typography
                variant="h2"
                sx={{
                  fontSize: { xs: "1.1rem", md: "1.3rem" },
                  fontWeight: 600,
                  color: "#000",
                }}
              >
                {course.title}
              </Typography>

              {/* Description */}
              {course.description ? (
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    fontSize: "0.9rem",
                    lineHeight: 1.4,
                    whiteSpace: "pre-line",
                  }}
                >
                  {course.description}
                </Typography>
              ) : null}
            </Stack>

            {/* Tiến độ tổng khoá */}
            <Stack spacing={1} sx={{ minWidth: { xs: "100%", sm: 200 } }}>
              <Chip
                label={`Tiến độ khoá: ${percentDisplay}%`}
                sx={{
                  borderColor: "#f97316",
                  color: "#f97316",
                  borderWidth: 2,
                  borderStyle: "solid",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  height: "28px",
                  borderRadius: "999px",
                  backgroundColor: "rgba(249,115,22,0.06)",
                  alignSelf: { xs: "flex-start", sm: "flex-end" },
                }}
                size="small"
              />

              <Box sx={{ width: "100%" }}>
                <LinearProgress
                  variant="determinate"
                  value={percentDisplay}
                  sx={{
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: "#eee",
                    "& .MuiLinearProgress-bar": {
                      backgroundColor: "#f97316",
                    },
                  }}
                />
              </Box>

              <Typography
                sx={{
                  fontSize: "0.75rem",
                  color: "#666",
                  textAlign: { xs: "left", sm: "right" },
                }}
              >
                {course.courseProgress?.is_completed
                  ? "Đã hoàn thành khoá"
                  : "Chưa hoàn thành khoá"}
              </Typography>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Danh sách bài học */}
      <Card
        sx={{
          borderRadius: "16px",
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
        }}
      >
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <Typography
            variant="h3"
            sx={{
              mb: 2,
              fontSize: "1rem",
              fontWeight: 600,
              color: "text.primary",
            }}
          >
            Danh sách bài học
          </Typography>

          <Stack spacing={1.5}>
            {Array.isArray(course.lessons) && course.lessons.length > 0 ? (
              course.lessons.map((lesson) => {
                const safeOrder =
                  typeof lesson.order === "number"
                    ? lesson.order
                    : (lesson as any).order_index ?? 0;

                const safeDuration =
                  typeof lesson.duration_minutes === "number"
                    ? lesson.duration_minutes
                    : null;

                return (
                  <LessonRow
                    key={lesson.id}
                    id={lesson.id}
                    order={safeOrder}
                    title={lesson.title || "Không có tiêu đề"}
                    type={lesson.type || "N/A"}
                    duration_minutes={safeDuration}
                    is_required={!!lesson.is_required}
                    completed={!!lesson.user_progress?.completed}
                    unlocked={lesson.user_progress?.unlocked ?? true}
                  />
                );
              })
            ) : (
              <Typography
                variant="body2"
                sx={{
                  color: "#666",
                  fontSize: "0.9rem",
                  lineHeight: 1.4,
                  p: 2,
                }}
              >
                Chưa có bài học nào trong khoá này.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
