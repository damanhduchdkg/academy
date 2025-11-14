"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Stack,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";

interface CourseItem {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  is_required: boolean;
  lessons_count: number;
  courseProgress: {
    completion_percent: number; // đã normalize từ BE
    is_completed: boolean; // đã normalize từ BE (>=100%)
  };
}

interface CoursesResponse {
  page: number;
  pageSize: number;
  total: number;
  data: CourseItem[];
}

export default function CoursesPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [coursesResp, setCoursesResp] = useState<CoursesResponse | null>(null);

  useEffect(() => {
    async function fetchCourses() {
      try {
        const token = window.localStorage.getItem("accessToken");
        if (!token) {
          window.location.href = "/login";
          return;
        }

        const res = await fetch(
          "http://localhost:3000/courses?page=1&pageSize=10",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = "/login";
            return;
          }
          setErr("Không tải được danh sách khoá học");
          setLoading(false);
          return;
        }

        const data = await res.json();
        setCoursesResp(data);
        setLoading(false);
      } catch (e) {
        setErr("Lỗi kết nối server");
        setLoading(false);
      }
    }

    fetchCourses();
  }, []);

  // LOADING
  if (loading) {
    return (
      <Box
        sx={{
          maxWidth: 1280,
          mx: "auto",
          mt: 4,
          px: 2,
          textAlign: "center",
        }}
      >
        <CircularProgress />
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", mt: 1, fontSize: "0.9rem" }}
        >
          Đang tải khoá học...
        </Typography>
      </Box>
    );
  }

  // ERROR
  if (err) {
    return (
      <Box sx={{ maxWidth: 1280, mx: "auto", mt: 4, px: 2 }}>
        <Alert severity="error" sx={{ fontSize: "0.9rem" }}>
          {err}
        </Alert>
      </Box>
    );
  }

  // OK DATA
  const items = coursesResp?.data ?? [];
  const pageInfo = coursesResp
    ? {
        page: coursesResp.page,
        total: coursesResp.total,
        count: items.length,
      }
    : { page: 1, total: 0, count: 0 };

  return (
    <Box
      sx={{
        maxWidth: 1280,
        mx: "auto",
        mt: 4,
        px: 2,
        pb: 6,
      }}
    >
      {/* PAGE TITLE */}
      <Typography
        variant="h4"
        sx={{
          fontWeight: 600,
          color: "#000",
          mb: 3,
          fontSize: { xs: "1.4rem", md: "1.6rem" },
        }}
      >
        Khoá đào tạo
      </Typography>

      {items.length === 0 ? (
        // fallback khi không có khoá
        <Card
          sx={{
            borderRadius: "20px",
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography
              variant="body1"
              sx={{ color: "#666", fontSize: "1rem" }}
            >
              Hiện chưa có khoá học nào phù hợp.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* CARD WRAPPER: flexbox responsive */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 3,
            }}
          >
            {items.map((course) => {
              // lấy % từ backend (đã normalize sẵn)
              const percent = Number(
                course.courseProgress?.completion_percent ?? 0
              );
              // đã normalize ở BE, nhưng ta vẫn clamp cho chắc
              const safePercent = Math.min(
                100,
                Math.max(0, Math.round(percent))
              );

              // is_completed giờ cũng đã normalize ở BE = safePercent >=100
              const finished = !!course.courseProgress?.is_completed;

              return (
                <Box
                  key={course.id}
                  sx={{
                    flex: "1 1 300px",
                    maxWidth: {
                      xs: "100%",
                      sm: "calc(50% - 12px)",
                      lg: "calc(33.333% - 16px)",
                    },
                    display: "flex",
                  }}
                >
                  <Card
                    sx={{
                      flexGrow: 1,
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: "20px",
                      boxShadow:
                        "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
                      border: "1px solid rgba(0,0,0,0.04)",
                      backgroundColor: "#fff",
                      width: "100%",
                    }}
                  >
                    <CardContent
                      sx={{
                        p: 3,
                        display: "flex",
                        flexDirection: "column",
                        flexGrow: 1,
                      }}
                    >
                      {/* TITLE + CHIP TIẾN ĐỘ */}
                      <Stack
                        direction="row"
                        flexWrap="wrap"
                        alignItems="flex-start"
                        spacing={1}
                        sx={{ mb: 1 }}
                      >
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            color: "#000",
                            fontSize: "1.05rem",
                            lineHeight: 1.4,
                          }}
                        >
                          {course.title}
                        </Typography>

                        {course.is_required && (
                          <Chip
                            size="small"
                            label="BẮT BUỘC"
                            sx={{
                              backgroundColor: "#d00000",
                              color: "#fff",
                              fontWeight: 600,
                              fontSize: "0.7rem",
                              height: "24px",
                              borderRadius: "999px",
                              px: 1,
                            }}
                          />
                        )}

                        {finished ? (
                          <Chip
                            size="small"
                            label="✔ Đã hoàn thành"
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
                        ) : (
                          <Chip
                            size="small"
                            label={`Tiến độ: ${safePercent}%`}
                            sx={{
                              borderColor: "#f97316",
                              color: "#f97316",
                              borderWidth: 1,
                              borderStyle: "solid",
                              fontWeight: 600,
                              fontSize: "0.7rem",
                              height: "24px",
                              borderRadius: "999px",
                              px: 1,
                              backgroundColor: "rgba(249,115,22,0.06)",
                            }}
                          />
                        )}
                      </Stack>

                      {/* DESCRIPTION */}
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#555",
                          fontSize: "0.9rem",
                          lineHeight: 1.4,
                          mb: 1,
                          flexGrow: 0,
                        }}
                      >
                        {course.description || "Khoá đào tạo nội bộ"}
                      </Typography>

                      {/* META */}
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#888",
                          fontSize: "0.8rem",
                          lineHeight: 1.4,
                          display: "block",
                          mb: 2,
                        }}
                      >
                        Danh mục: {course.category || "Chung"} •{" "}
                        {course.lessons_count} bài học
                      </Typography>

                      {/* ACTION BUTTON */}
                      <Button
                        variant="contained"
                        fullWidth
                        sx={{
                          backgroundColor: "#d00000",
                          borderRadius: "12px",
                          fontWeight: 600,
                          textTransform: "none",
                          py: 1.2,
                          fontSize: "0.95rem",
                          boxShadow:
                            "0 20px 40px rgba(208,0,0,0.3), 0 4px 8px rgba(0,0,0,0.08)",
                          "&:hover": {
                            backgroundColor: "#a00000",
                          },
                        }}
                        onClick={() => {
                          window.location.href = `/courses/${course.id}`;
                        }}
                      >
                        {finished ? "Xem lại khoá" : "Học ngay"}
                      </Button>
                    </CardContent>
                  </Card>
                </Box>
              );
            })}
          </Box>

          {/* FOOTER / PAGE INFO */}
          <Box
            sx={{
              mt: 4,
              textAlign: "center",
              fontSize: "0.8rem",
              color: "#777",
              width: "100%",
            }}
          >
            Đang xem {pageInfo.count} / {pageInfo.total} khoá (Trang{" "}
            {pageInfo.page})
          </Box>
        </>
      )}
    </Box>
  );
}
