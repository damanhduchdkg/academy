"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Checkbox,
  ListItemText,
} from "@mui/material";
import {
  Add as AddIcon,
  EditOutlined,
  DeleteOutline,
  RefreshOutlined,
  QueryStatsOutlined,
} from "@mui/icons-material";
import { authFetch } from "@/lib/authFetch";

/* ================== TYPES ================== */

type CourseLevel = "Basic" | "Advanced";
type CourseRole = "admin" | "manager" | "user";

type Course = {
  id: string;
  title: string;
  category: string | null;
  level?: CourseLevel | null;
  is_required: boolean;
  is_published: boolean;
  lessons_count: number;
  allowed_roles?: CourseRole[] | string[];
};

type SnackbarState = {
  open: boolean;
  message: string;
  severity: "success" | "error";
};

type CourseFormState = {
  title: string;
  category: string;
  level: CourseLevel;
  is_required: boolean;
  is_published: boolean;
  allowed_roles: CourseRole[];
};

/* ================== HELPERS ================== */

const roleLabels: Record<CourseRole, string> = {
  admin: "Admin",
  manager: "Quản lý",
  user: "Nhân viên",
};

const levelLabels: Record<CourseLevel, string> = {
  Basic: "Cơ bản",
  Advanced: "Nâng cao",
};

/* ================== COMPONENT ================== */

export default function AdminCoursesSection() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: "",
    severity: "success",
  });

  // ====== Confirm Delete Dialog ======
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm?: () => void;
  }>({
    open: false,
    title: "",
    message: "",
  });

  const showSuccess = (msg: string) =>
    setSnackbar({ open: true, message: msg, severity: "success" });
  const showError = (msg: string) =>
    setSnackbar({ open: true, message: msg, severity: "error" });

  // dialog thêm / sửa
  const [editOpen, setEditOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form, setForm] = useState<CourseFormState>({
    title: "",
    category: "",
    level: "Basic",
    is_required: false,
    is_published: true,
    allowed_roles: ["user"],
  });
  const isEditMode = !!editingCourse;

  /* ====== LOAD LIST KHOÁ HỌC (ADMIN) ====== */
  async function loadCourses() {
    setLoading(true);
    try {
      const res = await authFetch("/admin/courses", { method: "GET" });
      // BE: { page, pageSize, total, data }
      let rows = (res && (res as any).data) || res;

      if (!Array.isArray(rows)) {
        console.warn("Response /admin/courses không phải array:", res);
        rows = [];
      }

      setCourses(rows as Course[]);
    } catch (e) {
      console.error(e);
      showError("Không tải được danh sách khoá học");
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourses();
  }, []);

  /* ====== MỞ DIALOG THÊM / SỬA ====== */

  const openCreateDialog = () => {
    setEditingCourse(null);
    setForm({
      title: "",
      category: "",
      level: "Basic",
      is_required: false,
      is_published: true,
      allowed_roles: ["user"],
    });
    setEditOpen(true);
  };

  const openEditDialog = (course: Course) => {
    setEditingCourse(course);
    setForm({
      title: course.title,
      category: course.category || "",
      level: course.level || "Basic",
      is_required: course.is_required,
      is_published: course.is_published,
      allowed_roles: (course.allowed_roles || []) as CourseRole[],
    });
    setEditOpen(true);
  };

  /* ====== SUBMIT THÊM / SỬA ====== */

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      showError("Tên khoá không được để trống");
      return;
    }

    const payload = {
      title: form.title.trim(),
      category: form.category.trim(),
      level: form.level,
      is_required: form.is_required,
      is_published: form.is_published,
      allowed_roles: form.allowed_roles,
    };

    try {
      if (isEditMode && editingCourse) {
        await authFetch(`/admin/courses/${editingCourse.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        showSuccess("Cập nhật khoá học thành công");
      } else {
        await authFetch("/admin/courses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showSuccess("Thêm khoá học thành công");
      }

      setEditOpen(false);
      await loadCourses();
    } catch (e) {
      console.error(e);
      showError("Lưu khoá học thất bại");
    }
  };

  // ====== XOÁ KHOÁ ======
  const handleDelete = (course: Course) => {
    setConfirmDialog({
      open: true,
      title: "Xác nhận xoá khoá học",
      message: `Xoá khoá học "${course.title}"? Hành động này không thể hoàn tác.`,
      onConfirm: async () => {
        try {
          await authFetch(`/admin/courses/${course.id}`, {
            method: "DELETE",
          });

          setCourses((prev) => prev.filter((c) => c.id !== course.id));
          showSuccess("Đã xoá khoá học");
        } catch (e) {
          console.error(e);
          showError("Xoá khoá học thất bại");
        }
      },
    });
  };

  /* ====== BẬT / TẮT TRẠNG THÁI (is_published) ====== */

  const handleToggleStatus = async (course: Course) => {
    try {
      const updated = await authFetch(
        `/admin/courses/${course.id}/toggle-status`,
        {
          method: "POST",
        }
      );

      setCourses((prev) =>
        prev.map((c) =>
          c.id === course.id ? { ...c, is_published: updated.is_published } : c
        )
      );

      showSuccess(
        updated.is_published
          ? "Đã kích hoạt khoá học"
          : "Đã chuyển khoá học sang inactive"
      );
    } catch (e) {
      console.error(e);
      showError("Không đổi được trạng thái khoá học");
    }
  };

  /* ====== MỞ TRANG BÀI HỌC CỦA KHOÁ ====== */
  const handleOpenLessons = (courseId: string) => {
    if (typeof window === "undefined") return;
    window.location.href = `/admin/courses/${courseId}/lessons`;
  };

  /* ====== MỞ TRANG THỐNG KÊ CỦA KHOÁ ====== */
  const handleOpenAnalytics = (courseId: string) => {
    if (typeof window === "undefined") return;
    window.location.href = `/admin/courses/${courseId}/analytics`;
  };

  const handleExportAllCourses = async () => {
    try {
      if (typeof window === "undefined") return;

      const token =
        localStorage.getItem("accessToken") ||
        localStorage.getItem("token") ||
        localStorage.getItem("academy_token");

      if (!token) {
        alert("Không tìm thấy token đăng nhập!");
        return;
      }

      const apiBase =
        process.env.NEXT_PUBLIC_API_BASE || "http://192.168.0.113:3000";

      const url = `${apiBase}/admin/courses/export-report-all`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Export lỗi: ${res.status}`);
      }

      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "Bao_cao_khoa_hoc.xlsx"; // tên file
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Không xuất được báo cáo tổng các khoá");
    }
  };

  /* ================== RENDER ================== */

  return (
    <>
      <Card
        sx={{
          borderRadius: 3,
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          {/* HEADER */}
          <Box
            sx={{
              mb: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                Quản lý khoá học
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", fontSize: "0.9rem" }}
              >
                Danh sách các khoá học đang được sử dụng trong hệ thống đào tạo.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <IconButton
                onClick={loadCourses}
                title="Refresh danh sách"
                disabled={loading}
              >
                <RefreshOutlined />
              </IconButton>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={openCreateDialog}
                sx={{
                  borderRadius: "999px",
                  px: 2.5,
                  textTransform: "none",
                  fontWeight: 600,
                  backgroundColor: "#02006b",
                }}
              >
                Thêm khoá
              </Button>
              {/* NÚT BÁO CÁO TỔNG */}
              <Button
                variant="outlined"
                sx={{
                  borderRadius: "999px",
                  textTransform: "none",
                  fontWeight: 500,
                  px: 2.5,
                }}
                onClick={handleExportAllCourses}
              >
                📥 Xuất báo cáo tổng
              </Button>
            </Stack>
          </Box>

          {/* TABLE */}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={50}>#</TableCell>
                <TableCell>Tên khoá</TableCell>
                <TableCell>Danh mục</TableCell>
                <TableCell>Cấp độ</TableCell>
                <TableCell>Loại</TableCell>
                <TableCell>Áp dụng cho</TableCell>
                <TableCell align="center">Số bài học</TableCell>
                <TableCell align="center">Trạng thái</TableCell>
                <TableCell align="center">Bài học</TableCell>
                {/* <TableCell align="center">Thống kê</TableCell> */}
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {courses.map((course, idx) => (
                <TableRow key={course.id} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{course.title}</TableCell>
                  <TableCell>{course.category || "-"}</TableCell>
                  <TableCell>
                    {course.level
                      ? levelLabels[course.level as CourseLevel]
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {course.is_required ? "Bắt buộc" : "Tuỳ chọn"}
                  </TableCell>
                  <TableCell>
                    {course.allowed_roles && course.allowed_roles.length > 0
                      ? (course.allowed_roles as string[])
                          .map((r) => roleLabels[r as CourseRole] ?? r)
                          .join(", ")
                      : "Tất cả"}
                  </TableCell>
                  <TableCell align="center">
                    {course.lessons_count ?? 0}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      label={course.is_published ? "active" : "inactive"}
                      size="small"
                      sx={{
                        fontSize: "0.75rem",
                        textTransform: "lowercase",
                        borderRadius: "999px",
                        bgcolor: course.is_published
                          ? "#16a34a22"
                          : "#6b728022",
                        color: course.is_published ? "#15803d" : "#4b5563",
                        cursor: "pointer",
                      }}
                      onClick={() => handleToggleStatus(course)}
                    />
                  </TableCell>

                  {/* NÚT BÀI HỌC */}
                  <TableCell align="center">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleOpenLessons(course.id)}
                      sx={{
                        borderRadius: "999px",
                        textTransform: "none",
                        fontSize: "0.8rem",
                        px: 0.5,
                        py: 0.5,
                        borderWidth: 1.5,
                        "&:hover": {
                          borderWidth: 1.5,
                          backgroundColor: "rgba(2,0,107,0.06)",
                        },
                      }}
                    >
                      Bài học
                    </Button>
                  </TableCell>

                  {/* NÚT THỐNG KÊ */}
                  {/* <TableCell align="center">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleOpenAnalytics(course.id)}
                      sx={{
                        borderRadius: "999px",
                        textTransform: "none",
                        fontSize: "0.8rem",
                        px: 0.5,
                        py: 0.5,
                        borderWidth: 1.5,
                        "&:hover": {
                          borderWidth: 1.5,
                          backgroundColor: "rgba(2,0,107,0.06)",
                        },
                      }}
                    >
                      Thống kê
                    </Button>
                  </TableCell> */}

                  <TableCell align="right">
                    {/* Nút xem thống kê */}
                    <IconButton
                      size="small"
                      onClick={() => handleOpenAnalytics(course.id)}
                      title="Xem thống kê khoá học"
                    >
                      <QueryStatsOutlined fontSize="small" />
                    </IconButton>

                    {/* Nút sửa */}
                    <IconButton
                      size="small"
                      onClick={() => openEditDialog(course)}
                      title="Sửa khoá học"
                    >
                      <EditOutlined fontSize="small" />
                    </IconButton>

                    {/* Nút xoá */}
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(course)}
                      title="Xoá khoá học"
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}

              {courses.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={11}>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", textAlign: "center" }}
                    >
                      Chưa có khoá học nào.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DIALOG THÊM/SỬA */}
      <Dialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {isEditMode ? "Cập nhật khoá học" : "Thêm khoá học"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Tên khoá"
              size="small"
              fullWidth
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />

            <TextField
              label="Danh mục"
              size="small"
              fullWidth
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
            />

            <TextField
              label="Cấp độ"
              select
              size="small"
              fullWidth
              value={form.level}
              onChange={(e) =>
                setForm((f) => ({ ...f, level: e.target.value as CourseLevel }))
              }
            >
              <MenuItem value="Basic">Cơ bản</MenuItem>
              <MenuItem value="Advanced">Nâng cao</MenuItem>
            </TextField>

            <TextField
              label="Loại"
              select
              size="small"
              fullWidth
              value={form.is_required ? "required" : "optional"}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  is_required: e.target.value === "required",
                }))
              }
            >
              <MenuItem value="required">Bắt buộc</MenuItem>
              <MenuItem value="optional">Tuỳ chọn</MenuItem>
            </TextField>

            <TextField
              label="Áp dụng cho"
              select
              size="small"
              fullWidth
              SelectProps={{
                multiple: true,
                renderValue: (selected) =>
                  (selected as CourseRole[])
                    .map((r) => roleLabels[r] || r)
                    .join(", "),
              }}
              value={form.allowed_roles}
              onChange={(e) => {
                const value = e.target.value;
                setForm((f) => ({
                  ...f,
                  allowed_roles: (typeof value === "string"
                    ? value.split(",")
                    : value) as CourseRole[],
                }));
              }}
            >
              {(["admin", "manager", "user"] as CourseRole[]).map((role) => (
                <MenuItem key={role} value={role}>
                  <Checkbox
                    size="small"
                    checked={form.allowed_roles.indexOf(role) > -1}
                  />
                  <ListItemText primary={roleLabels[role]} />
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Trạng thái"
              select
              size="small"
              fullWidth
              value={form.is_published ? "active" : "inactive"}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  is_published: e.target.value === "active",
                }))
              }
            >
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="inactive">inactive</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Huỷ</Button>
          <Button onClick={handleSubmit} variant="contained">
            {isEditMode ? "Lưu thay đổi" : "Thêm mới"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* ======== CONFIRM DELETE DIALOG ======== */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((d) => ({ ...d, open: false }))}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>

        <DialogContent dividers>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() =>
              setConfirmDialog((d) => ({
                ...d,
                open: false,
              }))
            }
          >
            Huỷ
          </Button>

          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              try {
                await confirmDialog.onConfirm?.();
              } finally {
                setConfirmDialog((d) => ({ ...d, open: false }));
              }
            }}
          >
            Xoá
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
