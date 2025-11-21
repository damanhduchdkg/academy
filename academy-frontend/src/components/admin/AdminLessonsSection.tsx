"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
} from "@mui/material";
import {
  Add as AddIcon,
  EditOutlined,
  DeleteOutline,
  RefreshOutlined,
} from "@mui/icons-material";
import { authFetch } from "@/lib/authFetch";

type LessonType = "video" | "pdf" | "slide" | "text";

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  type: LessonType | string;
  duration_seconds: number;
  order_index: number;
  is_mandatory: boolean;
  created_at: string;
  updated_at: string;
};

type SnackbarState = {
  open: boolean;
  message: string;
  severity: "success" | "error" | "info";
};

type SimpleCourse = {
  id: string;
  title: string;
};

export default function AdminLessonsSection() {
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchTitle, setSearchTitle] = useState("");
  const [filterCourseId, setFilterCourseId] = useState("");

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: "",
    severity: "info",
  });

  const showSnackbar = (
    message: string,
    severity: SnackbarState["severity"] = "info"
  ) => setSnackbar({ open: true, message, severity });

  const handleCloseSnackbar = () =>
    setSnackbar((s) => ({
      ...s,
      open: false,
    }));

  /* =========== LOAD DANH SÁCH KHOÁ HỌC CHO DROPDOWN =========== */

  const [courses, setCourses] = useState<SimpleCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  async function loadCourses() {
    try {
      setCoursesLoading(true);
      const res = await authFetch("/admin/courses?page=1&pageSize=100", {
        method: "GET",
      });
      let rows: any = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      const mapped: SimpleCourse[] = rows.map((c: any) => ({
        id: c.id,
        title: c.title,
      }));
      setCourses(mapped);
    } catch (e) {
      console.error(e);
      showSnackbar("Không tải được danh sách khoá học", "error");
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  }

  /* =========== LOAD LIST BÀI HỌC =========== */
  async function loadLessons(_opts?: { resetPage?: boolean }) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("pageSize", "20");
      if (searchTitle.trim()) params.set("search", searchTitle.trim());
      if (filterCourseId.trim()) params.set("courseId", filterCourseId.trim());

      const res = await authFetch(`/admin/lessons?${params.toString()}`, {
        method: "GET",
      });

      // BE trả dạng: { data: [...], total, page, pageSize } hoặc array
      let rows: any = Array.isArray(res)
        ? res
        : Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.items)
        ? res.items
        : [];

      setLessons(rows as LessonRow[]);
    } catch (e) {
      console.error(e);
      showSnackbar("Không tải được danh sách bài học", "error");
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCourses();
    loadLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========== TẠO / SỬA BÀI HỌC =========== */

  type LessonFormState = {
    title: string;
    type: LessonType;
    duration_seconds: number | "";
    order_index: number | "";
    is_mandatory: boolean;
    course_id: string;
  };

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<LessonRow | null>(null);
  const [form, setForm] = useState<LessonFormState>({
    title: "",
    type: "video",
    duration_seconds: "",
    order_index: "",
    is_mandatory: true,
    course_id: "",
  });

  const isEditMode = !!editing;
  const isVideo = form.type === "video";

  const openCreateDialog = () => {
    setEditing(null);
    setForm({
      title: "",
      type: "video",
      duration_seconds: "",
      order_index: "",
      is_mandatory: true,
      // nếu đã có danh sách khoá → mặc định chọn khoá đầu tiên
      course_id: courses[0]?.id ?? "",
    });
    setEditOpen(true);
  };

  const openEditDialog = (lesson: LessonRow) => {
    setEditing(lesson);
    setForm({
      title: lesson.title,
      type: (lesson.type as LessonType) || "video",
      duration_seconds: lesson.duration_seconds ?? "",
      order_index: lesson.order_index ?? "",
      is_mandatory: lesson.is_mandatory,
      course_id: lesson.course_id,
    });
    setEditOpen(true);
  };

  const handleSubmitLesson = async () => {
    if (!form.title.trim()) {
      showSnackbar("Tiêu đề không được để trống", "error");
      return;
    }

    if (!form.course_id.trim() && !isEditMode) {
      // Khi tạo mới thì bắt buộc phải chọn khoá
      showSnackbar("Vui lòng chọn khoá học cho bài này", "error");
      return;
    }

    // Ở FE: cùng 1 field form.duration_seconds
    // - Nếu type = video  => hiểu là "thời lượng (giây)"
    // - Nếu type != video => hiểu là "số trang"
    const durationOrPages =
      form.duration_seconds === "" ? 0 : Number(form.duration_seconds);

    try {
      if (isEditMode && editing) {
        // ✅ UPDATE dùng route /admin/lessons/:id
        await authFetch(`/admin/lessons/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: form.title.trim(),
            type: form.type,
            duration_seconds: durationOrPages,
            order_index:
              form.order_index === "" ? undefined : Number(form.order_index),
            is_mandatory: form.is_mandatory,
            // course_id giữ nguyên course cũ, BE không cần đổi
          }),
        });
        showSnackbar("Cập nhật bài học thành công", "success");
      } else {
        // ✅ CREATE dùng route /admin/lessons
        await authFetch(`/admin/lessons`, {
          method: "POST",
          body: JSON.stringify({
            course_id: form.course_id.trim(),
            title: form.title.trim(),
            type: form.type,
            duration_seconds: durationOrPages,
            order_index:
              form.order_index === "" ? undefined : Number(form.order_index),
            is_mandatory: form.is_mandatory,
          }),
        });
        showSnackbar("Thêm bài học thành công", "success");
      }

      setEditOpen(false);
      await loadLessons();
    } catch (e) {
      console.error(e);
      showSnackbar("Lưu bài học thất bại", "error");
    }
  };

  /* =========== XOÁ BÀI HỌC =========== */

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    row: LessonRow | null;
  }>({ open: false, row: null });

  const openDeleteDialog = (row: LessonRow) => {
    setDeleteDialog({ open: true, row });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.row) return;
    try {
      await authFetch(`/admin/lessons/${deleteDialog.row.id}`, {
        method: "DELETE",
      });
      showSnackbar("Đã xoá bài học", "success");
      await loadLessons();
    } catch (e) {
      console.error(e);
      showSnackbar("Xoá bài học thất bại", "error");
    } finally {
      setDeleteDialog({ open: false, row: null });
    }
  };

  /* =========== RENDER =========== */

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
                Quản lý bài học
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", fontSize: "0.9rem" }}
              >
                Xem, tìm kiếm và chỉnh sửa toàn bộ bài học trong hệ thống.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <IconButton
                title="Làm mới"
                onClick={() => loadLessons()}
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
                Thêm bài học
              </Button>
            </Stack>
          </Box>

          {/* FILTER ROW */}
          <Box
            sx={{
              mb: 2.5,
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              alignItems: "center",
            }}
          >
            <TextField
              label="Tìm theo tiêu đề"
              size="small"
              fullWidth
              sx={{ flex: 1, minWidth: 260 }}
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
            />

            <TextField
              label="Lọc theo khoá học"
              select
              size="small"
              sx={{ width: 260 }}
              value={filterCourseId}
              onChange={(e) => setFilterCourseId(e.target.value)}
              disabled={coursesLoading}
            >
              <MenuItem value="">Tất cả khoá học</MenuItem>
              {courses.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.title}
                </MenuItem>
              ))}
            </TextField>

            <Button
              variant="outlined"
              onClick={() => loadLessons({ resetPage: true })}
              sx={{
                whiteSpace: "nowrap",
                px: 3,
                height: 40,
              }}
            >
              Áp dụng lọc
            </Button>
          </Box>

          {/* TABLE */}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={60}>#</TableCell>
                <TableCell>Tiêu đề</TableCell>
                <TableCell>Course ID</TableCell>
                <TableCell>Loại</TableCell>
                <TableCell align="right">Thời lượng / Số trang</TableCell>
                <TableCell align="center">Bắt buộc</TableCell>
                <TableCell align="right">Thứ tự</TableCell>
                <TableCell>Ngày tạo</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lessons.map((row, idx) => (
                <TableRow key={row.id} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>{row.course_id}</TableCell>
                  <TableCell>{row.type}</TableCell>
                  <TableCell align="right">
                    {row.duration_seconds ?? "-"}
                  </TableCell>
                  <TableCell align="center">
                    {row.is_mandatory ? "Bắt buộc" : "Tuỳ chọn"}
                  </TableCell>
                  <TableCell align="right">{row.order_index ?? "-"}</TableCell>
                  <TableCell>
                    {new Date(row.created_at).toLocaleString("vi-VN")}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      title="Sửa"
                      onClick={() => openEditDialog(row)}
                    >
                      <EditOutlined fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Xoá"
                      onClick={() => openDeleteDialog(row)}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}

              {!loading && lessons.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9}>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", textAlign: "center" }}
                    >
                      Chưa có bài học nào phù hợp bộ lọc.
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
          {isEditMode ? "Cập nhật bài học" : "Thêm bài học"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Tiêu đề"
              size="small"
              fullWidth
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />

            <TextField
              label="Khoá học"
              select
              size="small"
              fullWidth
              value={form.course_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, course_id: e.target.value }))
              }
              helperText={
                courses.length === 0
                  ? "Chưa có khoá học nào, hãy tạo khoá học trước."
                  : "Chọn khoá học mà bài này thuộc về."
              }
            >
              {courses.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.title}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Loại"
              select
              size="small"
              fullWidth
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as LessonType }))
              }
            >
              <MenuItem value="video">Video</MenuItem>
              <MenuItem value="pdf">PDF</MenuItem>
              <MenuItem value="slide">Slide</MenuItem>
              <MenuItem value="text">Text</MenuItem>
            </TextField>

            <TextField
              label={isVideo ? "Thời lượng (giây)" : "Số trang"}
              size="small"
              fullWidth
              type="number"
              value={form.duration_seconds}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  duration_seconds: e.target.value
                    ? Number(e.target.value)
                    : "",
                }))
              }
              helperText={
                isVideo
                  ? "Nhập tổng số giây của video (ví dụ 600 = 10 phút)."
                  : "Nhập tổng số trang của tài liệu (pdf/slide/docx...)."
              }
            />

            <TextField
              label="Thứ tự"
              size="small"
              fullWidth
              type="number"
              value={form.order_index}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  order_index: e.target.value ? Number(e.target.value) : "",
                }))
              }
              helperText="Thứ tự hiển thị trong khoá học"
            />

            <TextField
              label="Loại bài"
              select
              size="small"
              fullWidth
              value={form.is_mandatory ? "required" : "optional"}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  is_mandatory: e.target.value === "required",
                }))
              }
            >
              <MenuItem value="required">Bắt buộc</MenuItem>
              <MenuItem value="optional">Tuỳ chọn</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Huỷ</Button>
          <Button variant="contained" onClick={handleSubmitLesson}>
            {isEditMode ? "Lưu thay đổi" : "Thêm mới"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG XOÁ */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, row: null })}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Xoá bài học</DialogTitle>
        <DialogContent dividers>
          <Typography>
            {deleteDialog.row
              ? `Xoá bài "${deleteDialog.row.title}"? Hành động này không thể hoàn tác.`
              : "Bạn có chắc muốn xoá bài học này?"}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, row: null })}>
            Huỷ
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={handleConfirmDelete}
          >
            Xoá
          </Button>
        </DialogActions>
      </Dialog>

      {/* SNACKBAR */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
