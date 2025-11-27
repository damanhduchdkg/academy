"use client";

import React from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
} from "@mui/material";
import { authFetch } from "@/lib/authFetch";

type AdminDashboardStats = {
  totalUsers: number;
  activeUsers: number;
  totalCourses: number;
  publishedCourses: number;
  totalLessons: number;
  totalAssignments: number;
};

type CourseOverviewRow = {
  id: string;
  title: string;
  is_published: boolean;
  lessonsCount: number;
  assignmentsCount: number;
  completedUsers: number;
  activeLearners: number;
};

type RecentActivity = {
  userId: string | null;
  userName: string;
  userEmail: string | null;
  courseId: string | null;
  courseTitle: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
  lastSeenAt: string | null;
  completed: boolean;
  completedAt: string | null;
};

export default function AdminHomePage() {
  const [stats, setStats] = React.useState<AdminDashboardStats | null>(null);
  const [courses, setCourses] = React.useState<CourseOverviewRow[]>([]);
  const [activities, setActivities] = React.useState<RecentActivity[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [overview, courseRows, activityRows] = await Promise.all([
          authFetch("/admin/overview"),
          authFetch("/admin/overview/courses"),
          authFetch("/admin/overview/activity"),
        ]);

        if (cancelled) return;

        setStats(overview as AdminDashboardStats);
        setCourses(
          Array.isArray(courseRows) ? (courseRows as CourseOverviewRow[]) : []
        );
        setActivities(
          Array.isArray(activityRows) ? (activityRows as RecentActivity[]) : []
        );
        setErr(null);
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Không tải được thống kê hệ thống");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const safe = (value: number | undefined | null) =>
    typeof value === "number" && Number.isFinite(value) ? value : 0;

  const totalUsers = safe(stats?.totalUsers);
  const activeUsers = safe(stats?.activeUsers);
  const totalCourses = safe(stats?.totalCourses);
  const publishedCourses = safe(stats?.publishedCourses);
  const totalLessons = safe(stats?.totalLessons);
  const totalAssignments = safe(stats?.totalAssignments);

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
              Đang tải tổng quan hệ thống…
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", mt: 3, pb: 6 }}>
      {/* Header */}
      <Card
        sx={{
          borderRadius: 3,
          mb: 3,
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            Tổng quan hệ thống
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontSize: "0.9rem" }}
          >
            Đây là khu vực quản trị khoá học, bài học, user và file. Các số liệu
            bên dưới giúp Admin nắm nhanh tình hình hệ thống.
          </Typography>

          {err && (
            <Alert
              severity="warning"
              sx={{ mt: 2, fontSize: "0.85rem", alignItems: "center" }}
            >
              {err} — đang hiển thị số liệu 0 cho an toàn.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Dòng 1: 4 ô lớn */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          mb: 2,
        }}
      >
        <StatCard
          title="Tổng người dùng"
          value={totalUsers}
          subtitle="Số user trong hệ thống"
        />
        <StatCard
          title="Người dùng đang hoạt động"
          value={activeUsers}
          subtitle="Trong ~1 phút gần nhất"
        />
        <StatCard
          title="Tổng khoá học"
          value={totalCourses}
          subtitle="Bao gồm cả chưa publish"
        />
        <StatCard
          title="Khoá đã publish"
          value={publishedCourses}
          subtitle="Đang hiển thị cho user"
        />
      </Box>

      {/* Dòng 2: 2 ô rộng */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          mb: 3,
        }}
      >
        <StatCard
          title="Tổng số bài học"
          value={totalLessons}
          subtitle="Tất cả bài học trong các khoá"
          wide
        />
        <StatCard
          title="Tổng lượt gán khoá cho user"
          value={totalAssignments}
          subtitle="Số dòng trong bảng UserCourseAssignment"
          wide
        />
      </Box>

      {/* Bảng thống kê theo khoá học */}
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
            sx={{ fontSize: "1rem", fontWeight: 600, mb: 2 }}
          >
            Thống kê theo khoá học
          </Typography>

          {courses.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Chưa có khoá học nào.
            </Typography>
          ) : (
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Khoá học</TableCell>
                    <TableCell align="right">Bài học</TableCell>
                    <TableCell align="right">User được gán</TableCell>
                    <TableCell align="right">User hoàn thành</TableCell>
                    <TableCell align="right">User đang học</TableCell>
                    <TableCell align="center">Trạng thái</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {courses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.title}</TableCell>
                      <TableCell align="right">{c.lessonsCount}</TableCell>
                      <TableCell align="right">{c.assignmentsCount}</TableCell>
                      <TableCell align="right">{c.completedUsers}</TableCell>
                      <TableCell align="right">{c.activeLearners}</TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={c.is_published ? "Đang hiển thị" : "Nháp"}
                          color={c.is_published ? "success" : "default"}
                          sx={{ fontSize: "0.7rem" }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Nhật ký hoạt động học gần đây */}
      <Card
        sx={{
          borderRadius: 3,
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography
            variant="h6"
            sx={{ fontSize: "1rem", fontWeight: 600, mb: 2 }}
          >
            Hoạt động học gần đây
          </Typography>

          {activities.length === 0 ? (
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Chưa ghi nhận hoạt động nào.
            </Typography>
          ) : (
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Thời gian</TableCell>
                    <TableCell>Học viên</TableCell>
                    <TableCell>Khoá học</TableCell>
                    <TableCell>Bài học</TableCell>
                    <TableCell align="center">Trạng thái</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activities.map((a, idx) => {
                    const timeLabel = a.lastSeenAt
                      ? new Date(a.lastSeenAt).toLocaleString("vi-VN", {
                          hour12: false,
                        })
                      : "-";

                    const statusLabel = a.completed
                      ? "Đã hoàn thành"
                      : "Đang học";
                    const statusColor = a.completed ? "success" : "warning";

                    return (
                      <TableRow key={`${a.userId}-${a.lessonId}-${idx}`}>
                        <TableCell>{timeLabel}</TableCell>
                        <TableCell>
                          {a.userName}
                          {a.userEmail ? ` (${a.userEmail})` : ""}
                        </TableCell>
                        <TableCell>{a.courseTitle || "-"}</TableCell>
                        <TableCell>{a.lessonTitle || "-"}</TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={statusLabel}
                            color={statusColor as any}
                            sx={{ fontSize: "0.7rem" }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

type StatCardProps = {
  title: string;
  value: number;
  subtitle?: string;
  wide?: boolean;
};

function StatCard({ title, value, subtitle, wide }: StatCardProps) {
  return (
    <Card
      sx={{
        flex: wide ? "1 1 380px" : "1 1 260px",
        borderRadius: 3,
        boxShadow: "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography
          sx={{
            fontSize: "0.85rem",
            color: "#6b7280",
            fontWeight: 500,
            mb: 1,
          }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            fontSize: "2rem",
            fontWeight: 700,
            color: "#111827",
            mb: subtitle ? 0.5 : 0,
          }}
        >
          {value}
        </Typography>
        {subtitle && (
          <Typography
            sx={{
              fontSize: "0.8rem",
              color: "#9ca3af",
            }}
          >
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
