"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Box, Breadcrumbs, Link as MUILink, Typography } from "@mui/material";

import { useAuthGuard } from "@/hooks/useAuthGuard";
import AdminCourseLessonsSection from "@/components/admin/AdminCourseLessonsSection";

export default function AdminCourseLessonsPage() {
  // Bảo vệ quyền truy cập
  const { user, loading } = useAuthGuard({
    requiredRoles: ["admin", "manager"],
  });

  // Lấy courseId từ URL: /admin/courses/[courseId]/lessons
  const params = useParams();
  const courseId = (params?.courseId || "") as string;

  if (loading) return null;
  if (!user) return null;

  if (!courseId) {
    return (
      <Box sx={{ mt: 3, px: 2 }}>
        <Typography color="error">
          Không xác định được khoá học. Vui lòng quay lại danh sách khoá.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 3, px: 2 }}>
      {/* Breadcrumb */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <MUILink component={Link} href="/admin/courses" underline="hover">
          Quản lý khoá học
        </MUILink>
        <Typography color="text.primary">Bài học</Typography>
      </Breadcrumbs>

      {/* Bảng quản lý bài học theo courseId */}
      <AdminCourseLessonsSection courseId={courseId} />
    </Box>
  );
}
