"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Alert,
  CircularProgress,
} from "@mui/material";
import { authFetch } from "@/lib/authFetch";

type AdminOverview = {
  totalUsers: number;
  activeUsers: number;
  totalCourses: number;
  publishedCourses: number;
  totalLessons: number;
  totalAssignments: number;
};

export default function AdminDashboardPage() {
  const router = useRouter();

  const [data, setData] = React.useState<AdminOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      // kiểm tra token – nếu chưa đăng nhập thì đá về login
      const token =
        typeof window !== "undefined"
          ? window.localStorage.getItem("accessToken")
          : null;
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res: AdminOverview = await authFetch("/admin/overview", {
          method: "GET",
          timeoutMs: 12000,
          retries: 1,
        });
        if (!cancelled) {
          setData(res);
          setErr(null);
        }
      } catch (e: any) {
        if (cancelled) return;
        const msg = String(e?.message || "");
        if (msg.includes("401")) {
          router.push("/login");
          return;
        }
        setErr(msg || "Lỗi tải Dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const title = "Dashboard Admin";

  if (loading) {
    return (
      <Box
        sx={{ maxWidth: 1280, mx: "auto", mt: 4, px: 2, textAlign: "center" }}
      >
        <CircularProgress />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Đang tải Dashboard…
        </Typography>
      </Box>
    );
  }

  if (err) {
    return (
      <Box sx={{ maxWidth: 1280, mx: "auto", mt: 4, px: 2 }}>
        <Alert severity="error" sx={{ fontSize: "0.95rem" }}>
          {err}
        </Alert>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{ maxWidth: 1280, mx: "auto", mt: 4, px: 2 }}>
        <Alert severity="warning">Không có dữ liệu Dashboard.</Alert>
      </Box>
    );
  }

  const {
    totalUsers,
    activeUsers,
    totalCourses,
    publishedCourses,
    totalLessons,
    totalAssignments,
  } = data;

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto", mt: 4, px: 2, pb: 6 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          sx={{ fontSize: "1.4rem", fontWeight: 700, mb: 0.5 }}
        >
          {title}
        </Typography>
        <Typography variant="body2" sx={{ color: "#666", fontSize: "0.9rem" }}>
          Tóm tắt nhanh tình trạng người dùng, khoá học và bài học trong hệ
          thống.
        </Typography>
      </Box>

      {/* Hàng card trên */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          mb: 2,
        }}
      >
        <StatCard
          label="Tổng người dùng"
          value={totalUsers}
          hint="Số user trong hệ thống"
        />
        <StatCard
          label="Người dùng đang hoạt động"
          value={activeUsers}
          hint="Tạm thời = tổng user"
        />
        <StatCard
          label="Tổng khoá học"
          value={totalCourses}
          hint="Bao gồm cả chưa publish"
        />
        <StatCard
          label="Khoá đã publish"
          value={publishedCourses}
          hint="Đang hiển thị cho user"
        />
      </Box>

      {/* Hàng card dưới */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <StatCard
          label="Tổng số bài học"
          value={totalLessons}
          fullWidth
          hint="Tất cả bài trong mọi khoá"
        />
        <StatCard
          label="Tổng lượt gán khoá cho user"
          value={totalAssignments}
          fullWidth
          hint="Đếm record UserCourseAssignment"
        />
      </Box>
    </Box>
  );
}

/** Card nhỏ hiển thị số liệu */
type StatCardProps = {
  label: string;
  value: number | string;
  hint?: string;
  fullWidth?: boolean;
};

function StatCard({ label, value, hint, fullWidth }: StatCardProps) {
  return (
    <Card
      sx={{
        flex: fullWidth ? "1 1 100%" : "1 1 240px",
        borderRadius: "16px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.04), 0 8px 16px rgba(0,0,0,0.04)",
      }}
    >
      <CardContent sx={{ py: 2.5, px: 3 }}>
        <Typography
          sx={{
            fontSize: "0.8rem",
            color: "#666",
            mb: 1,
          }}
        >
          {label}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography
            sx={{
              fontSize: "1.6rem",
              fontWeight: 700,
              color: "#111",
            }}
          >
            {value}
          </Typography>
          {hint && (
            <Chip
              label={hint}
              size="small"
              sx={{
                fontSize: "0.7rem",
                height: 22,
                borderRadius: "999px",
                backgroundColor: "#f5f5f5",
              }}
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
