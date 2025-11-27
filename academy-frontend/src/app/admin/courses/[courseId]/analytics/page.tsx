"use client";

import React from "react";
import { useParams } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
} from "@mui/material";
import { authFetch } from "@/lib/authFetch";
import { ArrowBackIosNewOutlined, DownloadOutlined } from "@mui/icons-material";

type CourseInfo = {
  id: string;
  title: string;
  category: string | null;
  is_required: boolean;
  is_published: boolean;
  lessonsCount: number;
};

type CourseStats = {
  assignedUsers: number;
  startedUsers: number;
  completedUsers: number;
  activeUsers: number;
};

type UserRow = {
  user_id: string;
  full_name: string;
  role: string;
  completion_percent: number;
  is_completed: boolean;
  completed_at: string | null;
  last_seen_at: string | null;
  status: "not_started" | "learning" | "completed";
  is_online: boolean;
};

type CourseAnalyticsResponse = {
  course: CourseInfo;
  stats: CourseStats;
  users: UserRow[];
};

// Base URL cho backend – nên set trong .env
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE || "http://192.168.0.113:3000";

export default function CourseAnalyticsPage() {
  const params = useParams<{ courseId: string }>();
  const courseId = params?.courseId;

  const [data, setData] = React.useState<CourseAnalyticsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!courseId) {
        setErr("Thiếu courseId trên URL");
        setLoading(false);
        return;
      }

      try {
        const res = await authFetch(`/admin/courses/${courseId}/analytics`, {
          method: "GET",
          timeoutMs: 12000,
        });
        if (!cancelled) {
          setData(res as CourseAnalyticsResponse);
          setErr(null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Không tải được thống kê khoá học");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // ====== EXPORT CSV ======
  // const handleExportReport = async () => {
  //   if (!courseId) return;
  //   try {
  //     const token =
  //       localStorage.getItem("accessToken") ||
  //       localStorage.getItem("token") ||
  //       localStorage.getItem("academy_token");

  //     if (!token) {
  //       alert("Không tìm thấy token đăng nhập!");
  //       return;
  //     }

  //     const url = `${process.env.NEXT_PUBLIC_API_BASE}/admin/courses/${courseId}/export-report`;

  //     const res = await fetch(url, {
  //       method: "GET",
  //       headers: {
  //         Authorization: `Bearer ${token}`,
  //       },
  //     });

  //     if (!res.ok) {
  //       console.error("Export lỗi:", await res.text());
  //       alert("Xuất báo cáo thất bại. Mã lỗi: " + res.status);
  //       return;
  //     }

  //     const blob = await res.blob();
  //     const link = document.createElement("a");
  //     link.href = URL.createObjectURL(blob);
  //     link.download = `course-report-${courseId}.csv`;
  //     link.click();
  //     URL.revokeObjectURL(link.href);
  //   } catch (err: any) {
  //     console.error(err);
  //     alert("Lỗi xuất báo cáo CSV");
  //   }
  // };

  // trong CourseAnalyticsPage, chỗ handleExport
  const handleExport = async () => {
    if (!courseId) return;
    try {
      const token =
        localStorage.getItem("accessToken") ||
        localStorage.getItem("token") ||
        localStorage.getItem("academy_token");

      if (!token) {
        alert("Không tìm thấy token đăng nhập!");
        return;
      }

      const apiBase =
        process.env.NEXT_PUBLIC_API_BASE_URL || "http://192.168.0.113:3000";
      const url = `${apiBase}/admin/courses/${courseId}/export-report-excel`;

      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!resp.ok) {
        throw new Error(`Export lỗi: ${resp.status}`);
      }

      const blob = await resp.blob();

      // lấy filename từ header nếu có
      const cd = resp.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] || "Bao_cao_khoa_hoc.xlsx";

      const urlBlob = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlBlob;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(urlBlob);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Xuất báo cáo thất bại");
    }
  };
  if (loading) {
    return (
      <Box sx={{ maxWidth: 1280, mx: "auto", mt: 3 }}>
        <Card
          sx={{
            borderRadius: 3,
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
          }}
        >
          <CardContent
            sx={{
              p: 3,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <CircularProgress size={22} />
            <Typography variant="body2">
              Đang tải thống kê khoá học...
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ maxWidth: 1280, mx: "auto", mt: 3 }}>
        <Alert severity="error">Không có dữ liệu thống kê khoá học.</Alert>
      </Box>
    );
  }

  const { course, stats, users } = data;

  const formatDate = (d: string | null) => {
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleString();
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", mt: 3, pb: 4 }}>
      {/* Header + nút quay lại + xuất CSV */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography
          variant="h5"
          sx={{ fontWeight: 600, fontSize: "1.2rem", mr: 2 }}
        >
          Thống kê khoá học
        </Typography>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIosNewOutlined sx={{ fontSize: "0.8rem" }} />}
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/admin/courses";
              }
            }}
            sx={{
              borderRadius: "999px",
              textTransform: "none",
              fontWeight: 400,
              px: 2.5,
              py: 1,
            }}
          >
            Quay lại danh sách khoá học
          </Button>

          <Button
            variant="contained"
            startIcon={<DownloadOutlined />}
            onClick={handleExport}
            sx={{
              borderRadius: "999px",
              textTransform: "none",
              fontWeight: 500,
              px: 2.5,
              py: 1,
              backgroundColor: "#02006b",
              "&:hover": { backgroundColor: "#00004d" },
            }}
          >
            Xuất báo cáo Excel
          </Button>
        </Box>
      </Box>

      {/* Thông tin khoá học */}
      <Card
        sx={{
          borderRadius: 3,
          mb: 3,
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 600, mb: 1, fontSize: "1.05rem" }}
          >
            {course.title}
          </Typography>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 1 }}>
            {course.category && (
              <Chip
                size="small"
                label={course.category}
                sx={{
                  backgroundColor: "#eef2ff",
                  color: "#3730a3",
                  fontSize: "0.75rem",
                }}
              />
            )}

            {course.is_required && (
              <Chip
                size="small"
                label="Khoá bắt buộc"
                sx={{
                  backgroundColor: "#fee2e2",
                  color: "#b91c1c",
                  fontSize: "0.75rem",
                }}
              />
            )}

            <Chip
              size="small"
              label={course.is_published ? "Đang hiển thị" : "Chưa publish"}
              sx={{
                backgroundColor: course.is_published ? "#dcfce7" : "#e5e7eb",
                color: course.is_published ? "#166534" : "#374151",
                fontSize: "0.75rem",
              }}
            />

            <Chip
              size="small"
              label={`${course.lessonsCount} bài học`}
              sx={{
                backgroundColor: "#eff6ff",
                color: "#1d4ed8",
                fontSize: "0.75rem",
              }}
            />
          </Box>

          {err && (
            <Alert
              severity="warning"
              sx={{ mt: 1, fontSize: "0.8rem", alignItems: "center" }}
            >
              {err}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Các số liệu tổng hợp */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard
          title="User được gán khoá"
          value={stats.assignedUsers}
          subtitle="Số dòng trong UserCourseAssignment"
        />
        <StatCard
          title="User đã bắt đầu học"
          value={stats.startedUsers}
          subtitle="Có tiến độ hoặc đã mở bài học"
        />
        <StatCard
          title="User đã hoàn thành"
          value={stats.completedUsers}
          subtitle="is_completed = true"
        />
        <StatCard
          title="User đang học khoá này"
          value={stats.activeUsers}
          subtitle="Hoạt động trong ~1 phút gần nhất"
        />
      </Box>

      {/* Bảng chi tiết user */}
      <Card
        sx={{
          borderRadius: 3,
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
        }}
      >
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 600, fontSize: "0.95rem" }}
            >
              Danh sách người học trong khoá
            </Typography>
          </Box>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Họ tên</TableCell>
                <TableCell>Vai trò</TableCell>
                <TableCell align="right">% hoàn thành</TableCell>
                <TableCell>Trạng thái</TableCell>
                <TableCell>Online</TableCell>
                <TableCell>Hoạt động gần nhất</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography
                      sx={{
                        fontSize: "0.85rem",
                        color: "#6b7280",
                        p: 2,
                      }}
                    >
                      Chưa có user nào được gán khoá này.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.user_id} hover>
                    <TableCell>{u.full_name || "(Không tên)"}</TableCell>
                    <TableCell>{u.role}</TableCell>
                    <TableCell align="right">{u.completion_percent}%</TableCell>
                    <TableCell>
                      {u.status === "completed" && (
                        <Chip
                          label="Đã hoàn thành"
                          size="small"
                          sx={{
                            backgroundColor: "#dcfce7",
                            color: "#166534",
                            fontSize: "0.75rem",
                          }}
                        />
                      )}
                      {u.status === "learning" && (
                        <Chip
                          label="Đang học"
                          size="small"
                          sx={{
                            backgroundColor: "#fef9c3",
                            color: "#854d0e",
                            fontSize: "0.75rem",
                          }}
                        />
                      )}
                      {u.status === "not_started" && (
                        <Chip
                          label="Chưa bắt đầu"
                          size="small"
                          sx={{
                            backgroundColor: "#e5e7eb",
                            color: "#374151",
                            fontSize: "0.75rem",
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      {u.is_online ? (
                        <Chip
                          label="Online"
                          size="small"
                          sx={{
                            backgroundColor: "#dcfce7",
                            color: "#166534",
                            fontSize: "0.75rem",
                          }}
                        />
                      ) : (
                        <Chip
                          label="Offline"
                          size="small"
                          sx={{
                            backgroundColor: "#f3f4f6",
                            color: "#4b5563",
                            fontSize: "0.75rem",
                          }}
                        />
                      )}
                    </TableCell>
                    <TableCell>{formatDate(u.last_seen_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}

function StatCard(props: { title: string; value: number; subtitle?: string }) {
  const { title, value, subtitle } = props;
  return (
    <Card
      sx={{
        flex: "1 1 220px",
        borderRadius: 3,
        boxShadow: "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Typography
          sx={{
            fontSize: "0.8rem",
            color: "#6b7280",
            fontWeight: 500,
            mb: 0.5,
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            fontSize: "1.6rem",
            fontWeight: 700,
            color: "#111827",
            mb: subtitle ? 0.5 : 0,
          }}
        >
          {value}
        </Typography>
        {subtitle && (
          <Typography sx={{ fontSize: "0.75rem", color: "#9ca3af" }}>
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
function findJwtToken() {
  throw new Error("Function not implemented.");
}
