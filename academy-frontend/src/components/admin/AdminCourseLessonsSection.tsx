// src/components/admin/AdminCourseLessonsSection.tsx
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
  AttachFile as AttachFileIcon,
} from "@mui/icons-material";
import { authFetch } from "@/lib/authFetch";

type LessonType = "video" | "pdf" | "slide" | "text";

type Lesson = {
  id: string;
  title: string;
  type: LessonType;
  duration_seconds: number | null;
  is_mandatory: boolean;
  order_index: number;
  pdf_file_id?: string | null;
  pdf_url?: string | null;
  video_url?: string | null;
};

type SnackbarState = {
  open: boolean;
  message: string;
  severity: "success" | "error";
};

type LessonFormState = {
  title: string;
  type: LessonType;
  duration_seconds: number | "";
  is_mandatory: boolean;
  order_index: number | "";
};

// khớp BE
type FileItem = {
  id: string;
  file_name: string;
  mime_type: string;
};

type FileDialogState = {
  open: boolean;
  lesson: Lesson | null;

  attachType: "file" | "link";
  fileId: string;
  videoUrl: string;

  loading: boolean;
  files: FileItem[];
};

// Format thời lượng video: 90s -> "01:30", 3661 -> "01:01:01"
function formatVideoDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "-";

  const total = Math.floor(sec);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

// Hiển thị cột "Thời lượng" theo loại bài
function renderDurationCell(lesson: Lesson): string {
  if (lesson.duration_seconds == null) return "-";

  if (lesson.type === "video") {
    return formatVideoDuration(lesson.duration_seconds);
  }

  // pdf / slide => số trang
  if (lesson.type === "pdf" || lesson.type === "slide") {
    if (lesson.duration_seconds <= 0) return "-";
    return `${lesson.duration_seconds} trang`;
  }

  // text hoặc khác
  return "-";
}

export default function AdminCourseLessonsSection({
  courseId,
}: {
  courseId: string;
}) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(false);

  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: "",
    severity: "success",
  });

  const showSuccess = (msg: string) =>
    setSnackbar({ open: true, message: msg, severity: "success" });
  const showError = (msg: string) =>
    setSnackbar({ open: true, message: msg, severity: "error" });

  // dialog thêm / sửa
  const [editOpen, setEditOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [form, setForm] = useState<LessonFormState>({
    title: "",
    type: "video",
    duration_seconds: "",
    is_mandatory: false,
    order_index: "",
  });
  const isEditMode = !!editingLesson;

  // dialog xoá
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    lesson: Lesson | null;
  }>({
    open: false,
    lesson: null,
  });

  // dialog gán file / link
  const [fileDialog, setFileDialog] = useState<FileDialogState>({
    open: false,
    lesson: null,
    attachType: "file",
    fileId: "",
    videoUrl: "",
    loading: false,
    files: [],
  });

  /* ========== LOAD DANH SÁCH BÀI HỌC THEO COURSE ========== */

  async function loadLessons() {
    if (!courseId) return;
    setLoading(true);
    try {
      const res = await authFetch(
        `/admin/courses/${courseId}/lessons?page=1&pageSize=100`,
        { method: "GET" }
      );

      const anyRes = res as any;
      let rows: Lesson[] = [];

      if (Array.isArray(anyRes)) rows = anyRes;
      else if (Array.isArray(anyRes.data)) rows = anyRes.data;
      else if (Array.isArray(anyRes.items)) rows = anyRes.items;

      setLessons(
        (rows || []).sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      );
    } catch (e) {
      console.error(e);
      showError("Không tải được danh sách bài học");
      setLessons([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLessons();
  }, [courseId]);

  /* ========== THÊM / SỬA ========== */

  const openCreateDialog = () => {
    setEditingLesson(null);
    setForm({
      title: "",
      type: "video",
      duration_seconds: "",
      is_mandatory: true,
      order_index: lessons.length ? lessons.length + 1 : 1,
    });
    setEditOpen(true);
  };

  const openEditDialog = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setForm({
      title: lesson.title,
      type: lesson.type || "video",
      duration_seconds: lesson.duration_seconds ?? "",
      is_mandatory: lesson.is_mandatory,
      order_index: lesson.order_index,
    });
    setEditOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      showError("Tiêu đề bài học không được để trống");
      return;
    }

    const payload = {
      title: form.title.trim(),
      type: form.type,
      duration_seconds:
        form.duration_seconds === "" ? 0 : Number(form.duration_seconds),
      is_mandatory: form.is_mandatory,
      order_index:
        form.order_index === "" ? lessons.length + 1 : Number(form.order_index),
    };

    try {
      if (isEditMode && editingLesson) {
        // 🔧 SỬA: dùng /admin/lessons/:id (không kèm courseId) để khớp BE
        const updated = await authFetch(`/admin/lessons/${editingLesson.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        setLessons((prev) =>
          prev.map((l) =>
            l.id === editingLesson.id ? { ...l, ...(updated as any) } : l
          )
        );
        showSuccess("Cập nhật bài học thành công");
      } else {
        // Giữ nguyên: tạo mới qua route cũ theo courseId
        const created = await authFetch(`/admin/courses/${courseId}/lessons`, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setLessons((prev) =>
          [...prev, created as Lesson].sort(
            (a, b) => (a.order_index || 0) - (b.order_index || 0)
          )
        );
        showSuccess("Thêm bài học thành công");
      }

      setEditOpen(false);
    } catch (e) {
      console.error(e);
      showError("Lưu bài học thất bại");
    }
  };

  /* ========== XOÁ BÀI HỌC ========== */

  const openDeleteDialog = (lesson: Lesson) => {
    setDeleteDialog({ open: true, lesson });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.lesson) return;
    try {
      // 🔧 SỬA: xoá qua /admin/lessons/:id
      await authFetch(`/admin/lessons/${deleteDialog.lesson.id}`, {
        method: "DELETE",
      });

      setLessons((prev) =>
        prev
          .filter((l) => l.id !== deleteDialog.lesson!.id)
          .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
      );
      showSuccess("Đã xoá bài học");
    } catch (e) {
      console.error(e);
      showError("Xoá bài học thất bại");
    } finally {
      setDeleteDialog({ open: false, lesson: null });
    }
  };

  /* ========== GÁN FILE / LINK ========== */

  const openFileAttachDialog = async (lesson: Lesson) => {
    try {
      const res = await authFetch(`/admin/files?page=1&pageSize=200`);

      const anyRes = res as any;
      let rows: any[] = [];
      if (Array.isArray(anyRes)) rows = anyRes;
      else if (Array.isArray(anyRes.items)) rows = anyRes.items;
      else if (Array.isArray(anyRes.data)) rows = anyRes.data;

      const fileList: FileItem[] = (rows || []).map((f: any) => ({
        id: f.id,
        file_name: f.file_name || f.name || "File không tên",
        mime_type: f.mime_type || f.type || "",
      }));

      const defaultAttachType: "file" | "link" =
        lesson.type === "video" && lesson.video_url && !lesson.pdf_file_id
          ? "link"
          : "file";

      setFileDialog({
        open: true,
        lesson,
        attachType: defaultAttachType,
        fileId: lesson.pdf_file_id || "",
        videoUrl: lesson.video_url || "",
        files: fileList,
        loading: false,
      });
    } catch (e) {
      console.error(e);
      showError("Không tải được danh sách file");
    }
  };

  const handleAttachFile = async () => {
    if (!fileDialog.lesson) return;

    try {
      setFileDialog((s) => ({ ...s, loading: true }));

      let updated: any;

      if (fileDialog.attachType === "file") {
        if (!fileDialog.fileId.trim()) {
          showError("Vui lòng chọn file");
          setFileDialog((s) => ({ ...s, loading: false }));
          return;
        }

        updated = await authFetch(
          `/admin/lessons/${fileDialog.lesson.id}/attach-file`,
          {
            method: "PATCH",
            body: JSON.stringify({
              fileId: fileDialog.fileId.trim(),
            }),
          }
        );
      } else {
        const url = fileDialog.videoUrl.trim();
        if (!url) {
          showError("Vui lòng nhập link video");
          setFileDialog((s) => ({ ...s, loading: false }));
          return;
        }

        updated = await authFetch(
          `/admin/lessons/${fileDialog.lesson.id}/youtube`,
          {
            method: "PATCH",
            body: JSON.stringify({
              youtubeUrl: url,
            }),
          }
        );
      }

      setLessons((prev) =>
        prev.map((l) =>
          l.id === fileDialog.lesson!.id ? { ...l, ...(updated as any) } : l
        )
      );

      showSuccess("Cập nhật nội dung bài học thành công");

      setFileDialog({
        open: false,
        lesson: null,
        attachType: "file",
        fileId: "",
        videoUrl: "",
        loading: false,
        files: [],
      });
    } catch (e) {
      console.error(e);
      showError("Gán nội dung thất bại");
      setFileDialog((s) => ({ ...s, loading: false }));
    }
  };

  /* ========== RENDER ========== */

  const isPdfOrSlide = form.type === "pdf" || form.type === "slide";

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
                Danh sách bài học thuộc khoá hiện tại.
              </Typography>
            </Box>

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
          </Box>

          {/* TABLE */}
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={60}>Thứ tự</TableCell>
                <TableCell>Tiêu đề</TableCell>
                <TableCell>Loại</TableCell>
                <TableCell align="center">Thời lượng / Số trang</TableCell>
                <TableCell align="center">Bắt buộc</TableCell>
                <TableCell align="right">Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {lessons.map((lesson) => (
                <TableRow key={lesson.id} hover>
                  <TableCell>{lesson.order_index}</TableCell>
                  <TableCell>{lesson.title}</TableCell>
                  <TableCell>{lesson.type}</TableCell>
                  <TableCell align="center">
                    {renderDurationCell(lesson)}
                  </TableCell>
                  <TableCell align="center">
                    {lesson.is_mandatory ? "Bắt buộc" : "Tuỳ chọn"}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      title="Gán / đổi nội dung"
                      onClick={() => openFileAttachDialog(lesson)}
                    >
                      <AttachFileIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Sửa bài học"
                      onClick={() => openEditDialog(lesson)}
                    >
                      <EditOutlined fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="Xoá bài học"
                      onClick={() => openDeleteDialog(lesson)}
                    >
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}

              {lessons.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", textAlign: "center" }}
                    >
                      Chưa có bài học nào.
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
              label="Loại nội dung"
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

            {/* Ô nhập động: video = thời lượng; pdf/slide = số trang */}
            <TextField
              label={isPdfOrSlide ? "Số trang / slide" : "Thời lượng (giây)"}
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
                isPdfOrSlide
                  ? "Nhập tổng số trang của tài liệu (PDF/slide)."
                  : "Thời lượng video, tính bằng giây."
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
              label="Loại bài (bắt buộc / tuỳ chọn)"
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
          <Button onClick={handleSubmit} variant="contained">
            {isEditMode ? "Lưu thay đổi" : "Thêm mới"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG XOÁ */}
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, lesson: null })}
      >
        <DialogTitle>Xoá bài học</DialogTitle>
        <DialogContent dividers>
          <Typography>
            {deleteDialog.lesson
              ? `Xoá bài "${deleteDialog.lesson.title}"? Hành động này không thể hoàn tác.`
              : "Bạn có chắc muốn xoá bài học này?"}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialog({ open: false, lesson: null })}
          >
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

      {/* DIALOG GÁN NỘI DUNG */}
      <Dialog
        open={fileDialog.open}
        onClose={() =>
          setFileDialog({
            open: false,
            lesson: null,
            attachType: "file",
            fileId: "",
            videoUrl: "",
            loading: false,
            files: [],
          })
        }
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          {fileDialog.lesson
            ? `Gán nội dung cho "${fileDialog.lesson.title}"`
            : "Gán nội dung cho bài học"}
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Loại nội dung"
              select
              size="small"
              fullWidth
              value={fileDialog.attachType}
              onChange={(e) =>
                setFileDialog((s) => ({
                  ...s,
                  attachType: e.target.value as "file" | "link",
                }))
              }
            >
              <MenuItem value="file">File (PDF, slide...)</MenuItem>
              <MenuItem value="link">Link YouTube / Video</MenuItem>
            </TextField>

            {fileDialog.attachType === "file" && (
              <TextField
                label="Chọn file"
                select
                size="small"
                fullWidth
                value={fileDialog.fileId}
                onChange={(e) =>
                  setFileDialog((s) => ({ ...s, fileId: e.target.value }))
                }
              >
                {fileDialog.files.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.file_name} ({f.mime_type})
                  </MenuItem>
                ))}
              </TextField>
            )}

            {fileDialog.attachType === "link" && (
              <TextField
                label="Nhập link video"
                size="small"
                fullWidth
                value={fileDialog.videoUrl}
                onChange={(e) =>
                  setFileDialog((s) => ({ ...s, videoUrl: e.target.value }))
                }
                placeholder="https://youtube.com/..."
              />
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() =>
              setFileDialog({
                open: false,
                lesson: null,
                attachType: "file",
                fileId: "",
                videoUrl: "",
                loading: false,
                files: [],
              })
            }
          >
            Huỷ
          </Button>

          <Button
            variant="contained"
            onClick={handleAttachFile}
            disabled={fileDialog.loading}
          >
            {fileDialog.loading ? "Đang lưu..." : "Lưu"}
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
    </>
  );
}
