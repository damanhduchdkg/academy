"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Stack,
  Button,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  Snackbar,
  InputAdornment,
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import PasswordIcon from "@mui/icons-material/Password";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import { authFetch } from "@/lib/authFetch";

type AdminUser = {
  id: string;
  full_name: string;
  username: string;
  role: "admin" | "manager" | "user" | string;
  department: string | null;
  status?: string | null; // 'active' | 'inactive' ...
};

type SnackbarState = {
  open: boolean;
  message: string;
  severity: "success" | "error" | "info" | "warning";
};

export default function AdminUsersSection() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // ========= SNACKBAR =========
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: "",
    severity: "info",
  });

  const showSnackbar = (
    message: string,
    severity: SnackbarState["severity"] = "info"
  ) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar((s) => ({ ...s, open: false }));
  };

  // ========= LOAD LIST =========
  const loadUsers = async () => {
    try {
      setLoading(true);
      setErr(null);

      const data = await authFetch("/users/admin", { method: "GET" });
      const list: AdminUser[] = Array.isArray(data?.data) ? data.data : data;
      setUsers(list);
    } catch (e: any) {
      const msg = e?.message || "Không tải được danh sách user";
      setErr(msg);
      showSnackbar(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // ========= TẠO USER =========
  const [openCreate, setOpenCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: "",
    username: "",
    password: "",
    role: "user",
    department: "",
  });

  const handleOpenCreate = () => {
    setCreateErr(null);
    setNewUser({
      full_name: "",
      username: "",
      password: "",
      role: "user",
      department: "",
    });
    setShowCreatePassword(false);
    setOpenCreate(true);
  };

  const handleCreateUser = async () => {
    if (!newUser.full_name || !newUser.username || !newUser.password) {
      const msg = "Vui lòng nhập đủ Họ tên, Username và Mật khẩu";
      setCreateErr(msg);
      showSnackbar(msg, "warning");
      return;
    }

    try {
      setCreating(true);
      setCreateErr(null);

      await authFetch("/users/admin", {
        method: "POST",
        body: JSON.stringify({
          full_name: newUser.full_name,
          username: newUser.username,
          password: newUser.password,
          role: newUser.role,
          department: newUser.department || null,
        }),
      });

      setOpenCreate(false);
      showSnackbar("Tạo user mới thành công", "success");
      await loadUsers();
    } catch (e: any) {
      const msg = e?.message || "Không tạo được user";
      setCreateErr(msg);
      showSnackbar(msg, "error");
    } finally {
      setCreating(false);
    }
  };

  // ========= ĐỔI / RESET MẬT KHẨU =========
  const [openChangePass, setOpenChangePass] = useState(false);
  const [changePassUser, setChangePassUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [changeErr, setChangeErr] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  const openChangePasswordDialog = (u: AdminUser) => {
    setChangeErr(null);
    setChangePassUser(u);
    setNewPassword("");
    setShowChangePassword(false);
    setOpenChangePass(true);
  };

  const callChangePasswordApi = async (userId: string, password: string) => {
    // nếu BE của bạn dùng endpoint khác, chỉ cần sửa chỗ này
    return authFetch(`/users/admin/${userId}/password`, {
      method: "PATCH",
      body: JSON.stringify({ password }),
    });
  };

  const handleChangePassword = async () => {
    if (!changePassUser) return;
    if (!newPassword || newPassword.length < 6) {
      const msg = "Mật khẩu mới tối thiểu 6 ký tự";
      setChangeErr(msg);
      showSnackbar(msg, "warning");
      return;
    }

    try {
      setChanging(true);
      setChangeErr(null);

      await callChangePasswordApi(changePassUser.id, newPassword);

      setOpenChangePass(false);
      showSnackbar("Đổi mật khẩu thành công", "success");
    } catch (e: any) {
      const msg = e?.message || "Không đổi được mật khẩu";
      setChangeErr(msg);
      showSnackbar(msg, "error");
    } finally {
      setChanging(false);
    }
  };

  const handleResetDefaultPassword = async () => {
    if (!changePassUser) return;
    const DEFAULT_PASSWORD = "123456";

    try {
      setChanging(true);
      setChangeErr(null);

      await callChangePasswordApi(changePassUser.id, DEFAULT_PASSWORD);

      setOpenChangePass(false);
      showSnackbar(
        `Đã reset mật khẩu về mặc định: ${DEFAULT_PASSWORD}`,
        "success"
      );
    } catch (e: any) {
      const msg = e?.message || "Không reset được mật khẩu";
      setChangeErr(msg);
      showSnackbar(msg, "error");
    } finally {
      setChanging(false);
    }
  };

  // ========= CẬP NHẬT USER =========
  const [openEdit, setOpenEdit] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editData, setEditData] = useState({
    full_name: "",
    role: "user",
    department: "",
    status: "active",
  });
  const [editing, setEditing] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const openEditDialog = (u: AdminUser) => {
    setEditingUser(u);
    setEditData({
      full_name: u.full_name,
      role: (u.role as string) || "user",
      department: u.department || "",
      status: u.status || "active",
    });
    setEditErr(null);
    setOpenEdit(true);
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;
    if (!editData.full_name) {
      const msg = "Họ tên không được để trống";
      setEditErr(msg);
      showSnackbar(msg, "warning");
      return;
    }

    try {
      setEditing(true);
      setEditErr(null);

      await authFetch(`/users/admin/${editingUser.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          full_name: editData.full_name,
          role: editData.role,
          department: editData.department || null,
          status: editData.status || "active",
        }),
      });

      setOpenEdit(false);
      showSnackbar("Cập nhật thông tin user thành công", "success");
      await loadUsers();
    } catch (e: any) {
      const msg = e?.message || "Không cập nhật được user";
      setEditErr(msg);
      showSnackbar(msg, "error");
    } finally {
      setEditing(false);
    }
  };

  // ========= XOÁ USER =========
  const [openDelete, setOpenDelete] = useState(false);
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openDeleteDialog = (u: AdminUser) => {
    setDeletingUser(u);
    setOpenDelete(true);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    try {
      setDeleting(true);

      await authFetch(`/users/admin/${deletingUser.id}`, {
        method: "DELETE",
      });

      setOpenDelete(false);
      showSnackbar("Đã xoá user", "success");
      await loadUsers();
    } catch (e: any) {
      const msg = e?.message || "Không xoá được user";
      showSnackbar(msg, "error");
    } finally {
      setDeleting(false);
    }
  };

  // ========= UI =========
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
          {/* Header */}
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ mb: 2 }}
            spacing={2}
          >
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                Quản lý user
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: "text.secondary", fontSize: "0.9rem" }}
              >
                Danh sách tài khoản dùng để đăng nhập hệ thống đào tạo.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Tooltip title="Tải lại">
                <IconButton onClick={loadUsers}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                color="primary"
                onClick={handleOpenCreate}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Thêm user
              </Button>
            </Stack>
          </Stack>

          {/* Error tổng */}
          {err && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {err}
            </Alert>
          )}

          {/* Loading / Table */}
          {loading ? (
            <Box
              sx={{
                minHeight: 120,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress size={28} />
            </Box>
          ) : users.length === 0 ? (
            <Typography>Chưa có user nào.</Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Họ tên</TableCell>
                    <TableCell>Username</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Phòng ban</TableCell>
                    <TableCell>Trạng thái</TableCell>
                    <TableCell align="right">Thao tác</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((u, idx) => (
                    <TableRow key={u.id}>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{u.full_name}</TableCell>
                      <TableCell>{u.username}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={u.role}
                          color={
                            u.role === "admin"
                              ? "error"
                              : u.role === "manager"
                              ? "primary"
                              : "default"
                          }
                          sx={{ textTransform: "none" }}
                        />
                      </TableCell>
                      <TableCell>{u.department || "-"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={u.status || "active"}
                          color={
                            !u.status || u.status === "active"
                              ? "success"
                              : "default"
                          }
                          sx={{ textTransform: "none" }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="flex-end"
                        >
                          <Tooltip title="Cập nhật thông tin">
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog(u)}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Đổi / reset mật khẩu">
                            <IconButton
                              size="small"
                              onClick={() => openChangePasswordDialog(u)}
                            >
                              <PasswordIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Xoá user">
                            <IconButton
                              size="small"
                              onClick={() => openDeleteDialog(u)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>

        {/* ========== Dialog tạo user ========== */}
        <Dialog
          open={openCreate}
          onClose={() => !creating && setOpenCreate(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Thêm user mới</DialogTitle>
          <DialogContent dividers>
            {createErr && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {createErr}
              </Alert>
            )}

            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Họ tên"
                value={newUser.full_name}
                onChange={(e) =>
                  setNewUser((s) => ({ ...s, full_name: e.target.value }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Username"
                value={newUser.username}
                onChange={(e) =>
                  setNewUser((s) => ({ ...s, username: e.target.value }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Mật khẩu"
                type={showCreatePassword ? "text" : "password"}
                value={newUser.password}
                onChange={(e) =>
                  setNewUser((s) => ({ ...s, password: e.target.value }))
                }
                fullWidth
                size="small"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowCreatePassword((prev) => !prev)}
                        edge="end"
                      >
                        {showCreatePassword ? (
                          <VisibilityOff fontSize="small" />
                        ) : (
                          <Visibility fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Role"
                select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser((s) => ({ ...s, role: e.target.value }))
                }
                size="small"
                fullWidth
              >
                <MenuItem value="admin">admin</MenuItem>
                <MenuItem value="manager">manager</MenuItem>
                <MenuItem value="user">user</MenuItem>
              </TextField>
              <TextField
                label="Phòng ban"
                value={newUser.department}
                onChange={(e) =>
                  setNewUser((s) => ({ ...s, department: e.target.value }))
                }
                fullWidth
                size="small"
                placeholder="vd: Kỹ thuật"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setOpenCreate(false)}
              disabled={creating}
              sx={{ textTransform: "none" }}
            >
              Huỷ
            </Button>
            <Button
              onClick={handleCreateUser}
              variant="contained"
              disabled={creating}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {creating ? "Đang tạo..." : "Tạo user"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ========== Dialog đổi / reset mật khẩu ========== */}
        <Dialog
          open={openChangePass}
          onClose={() => !changing && setOpenChangePass(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>
            Đổi / Reset mật khẩu{" "}
            {changePassUser ? `cho "${changePassUser.username}"` : ""}
          </DialogTitle>
          <DialogContent dividers>
            {changeErr && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {changeErr}
              </Alert>
            )}

            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <TextField
                label="Mật khẩu mới (tuỳ chọn)"
                type={showChangePassword ? "text" : "password"}
                fullWidth
                size="small"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                helperText="Để trống nếu chỉ muốn reset về mật khẩu mặc định 123456."
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        onClick={() => setShowChangePassword((prev) => !prev)}
                        edge="end"
                      >
                        {showChangePassword ? (
                          <VisibilityOff fontSize="small" />
                        ) : (
                          <Visibility fontSize="small" />
                        )}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <Typography
                variant="caption"
                sx={{ color: "text.secondary", mt: 0.5 }}
              >
                • Nhấn <b>Lưu mật khẩu mới</b> nếu bạn nhập mật khẩu phía trên.
                <br />• Hoặc nhấn <b>Reset về 123456</b> để đặt lại mật khẩu mặc
                định.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setOpenChangePass(false)}
              disabled={changing}
              sx={{ textTransform: "none" }}
            >
              Đóng
            </Button>
            <Button
              onClick={handleResetDefaultPassword}
              disabled={changing}
              color="warning"
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              Reset về 123456
            </Button>
            <Button
              onClick={handleChangePassword}
              variant="contained"
              disabled={changing}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {changing ? "Đang lưu..." : "Lưu mật khẩu mới"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ========== Dialog chỉnh sửa user ========== */}
        <Dialog
          open={openEdit}
          onClose={() => !editing && setOpenEdit(false)}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>
            Cập nhật thông tin {editingUser ? `"${editingUser.username}"` : ""}
          </DialogTitle>
          <DialogContent dividers>
            {editErr && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {editErr}
              </Alert>
            )}

            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Họ tên"
                value={editData.full_name}
                onChange={(e) =>
                  setEditData((s) => ({ ...s, full_name: e.target.value }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Role"
                select
                value={editData.role}
                onChange={(e) =>
                  setEditData((s) => ({ ...s, role: e.target.value }))
                }
                fullWidth
                size="small"
              >
                <MenuItem value="admin">admin</MenuItem>
                <MenuItem value="manager">manager</MenuItem>
                <MenuItem value="user">user</MenuItem>
              </TextField>
              <TextField
                label="Phòng ban"
                value={editData.department}
                onChange={(e) =>
                  setEditData((s) => ({ ...s, department: e.target.value }))
                }
                fullWidth
                size="small"
              />
              <TextField
                label="Trạng thái"
                select
                value={editData.status}
                onChange={(e) =>
                  setEditData((s) => ({ ...s, status: e.target.value }))
                }
                fullWidth
                size="small"
              >
                <MenuItem value="active">active</MenuItem>
                <MenuItem value="inactive">inactive</MenuItem>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setOpenEdit(false)}
              disabled={editing}
              sx={{ textTransform: "none" }}
            >
              Huỷ
            </Button>
            <Button
              onClick={handleUpdateUser}
              variant="contained"
              disabled={editing}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {editing ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ========== Dialog xoá user ========== */}
        <Dialog
          open={openDelete}
          onClose={() => !deleting && setOpenDelete(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>Xoá user</DialogTitle>
          <DialogContent dividers>
            <Typography>
              Bạn chắc chắn muốn xoá user <b>{deletingUser?.username}</b>? Hành
              động này không thể hoàn tác.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setOpenDelete(false)}
              disabled={deleting}
              sx={{ textTransform: "none" }}
            >
              Huỷ
            </Button>
            <Button
              onClick={handleDeleteUser}
              color="error"
              variant="contained"
              disabled={deleting}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {deleting ? "Đang xoá..." : "Xoá"}
            </Button>
          </DialogActions>
        </Dialog>
      </Card>

      {/* SNACKBAR dùng chung */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
