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
  TextField,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

interface CourseItem {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  is_required: boolean;
  lessons_count: number;
  courseProgress: {
    completion_percent: number;
    is_completed: boolean;
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

  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // debounce search
  useEffect(() => {
    const handle = setTimeout(() => {
      setSearchTerm(searchInput.trim());
    }, 400);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // fetch courses
  useEffect(() => {
    async function fetchCourses(currentSearch: string) {
      try {
        setLoading(true);
        setErr(null);

        const token = window.localStorage.getItem("accessToken");
        if (!token) {
          window.location.href = "/login";
          return;
        }

        const url = new URL("http://localhost:3000/courses");
        url.searchParams.set("page", "1");
        url.searchParams.set("pageSize", "10");
        if (currentSearch) {
          url.searchParams.set("search", currentSearch);
        }

        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = "/login";
            return;
          }
          setErr("Không tải được danh sách khoá học");
          setCoursesResp(null);
          return;
        }

        const data = (await res.json()) as CoursesResponse;
        setCoursesResp(data);
      } catch (e) {
        setErr("Lỗi kết nối server");
        setCoursesResp(null);
      } finally {
        setLoading(false);
      }
    }

    fetchCourses(searchTerm);
  }, [searchTerm]);

  if (loading && !coursesResp && !err) {
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

  if (err && !coursesResp) {
    return (
      <Box sx={{ maxWidth: 1280, mx: "auto", mt: 4, px: 2 }}>
        <Alert severity="error" sx={{ fontSize: "0.9rem" }}>
          {err}
        </Alert>
      </Box>
    );
  }

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
      {/* HEADER + SEARCH */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "flex-start", md: "center" },
          justifyContent: "space-between",
          gap: 2,
          mb: 3,
        }}
      >
        <Typography
          variant="h4"
          sx={{
            fontWeight: 600,
            color: "#000",
            fontSize: { xs: "1.4rem", md: "1.6rem" },
          }}
        >
          Khoá đào tạo
        </Typography>

        <TextField
          size="small"
          placeholder="Tìm kiếm khoá học theo tên, danh mục..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{
            width: { xs: "100%", md: 320 },
            backgroundColor: "#fff",
            borderRadius: "999px",
            "& .MuiOutlinedInput-root": {
              borderRadius: "999px",
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 20, color: "#9ca3af" }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {err && coursesResp && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="warning" sx={{ fontSize: "0.8rem" }}>
            {err}
          </Alert>
        </Box>
      )}

      {items.length === 0 ? (
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
              sx={{ color: "#666", fontSize: "1rem", mb: 0.5 }}
            >
              {searchTerm
                ? `Không tìm thấy khoá học phù hợp với từ khoá “${searchTerm}”.`
                : "Hiện chưa có khoá học nào phù hợp."}
            </Typography>
            {searchTerm && (
              <Typography
                variant="body2"
                sx={{ color: "#9ca3af", fontSize: "0.85rem" }}
              >
                Thử rút ngắn hoặc đổi lại từ khoá khác (không cần gõ đúng dấu).
              </Typography>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 3,
            }}
          >
            {items.map((course) => {
              const percent = Number(
                course.courseProgress?.completion_percent ?? 0
              );
              const safePercent = Math.min(
                100,
                Math.max(0, Math.round(percent))
              );
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
                      {/* TIÊU ĐỀ (clamp 2 dòng) */}
                      <Box sx={{ mb: 1 }}>
                        <Typography
                          variant="h6"
                          sx={{
                            fontWeight: 600,
                            color: "#000",
                            fontSize: "1.05rem",
                            lineHeight: 1.4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {course.title}
                        </Typography>
                      </Box>

                      {/* HÀNG CHIP: BẮT BUỘC + TIẾN ĐỘ / ĐÃ HOÀN THÀNH */}
                      <Stack
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        spacing={1}
                        sx={{ mb: 1.5, minHeight: 32 }}
                      >
                        <Box sx={{ minWidth: 0 }}>
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
                        </Box>

                        <Box sx={{ flexShrink: 0 }}>
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
                        </Box>
                      </Stack>

                      {/* DESCRIPTION (clamp 2 dòng) */}
                      <Typography
                        variant="body2"
                        sx={{
                          color: "#555",
                          fontSize: "0.9rem",
                          lineHeight: 1.4,
                          mb: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {course.description || "Khoá đào tạo nội bộ"}
                      </Typography>

                      {/* META (clamp 1 dòng) */}
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#888",
                          fontSize: "0.8rem",
                          lineHeight: 1.4,
                          display: "block",
                          mb: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Danh mục: {course.category || "Chung"} •{" "}
                        {course.lessons_count} bài học
                      </Typography>

                      {/* BUTTON */}
                      <Button
                        variant="contained"
                        fullWidth
                        sx={{
                          mt: "auto",
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
            {pageInfo.page}
            {searchTerm ? `, từ khoá “${searchTerm}”` : ""})
          </Box>
        </>
      )}
    </Box>
  );
}
