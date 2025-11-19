"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      // cố gắng đọc body để bắt message/code từ BE
      const data = await res
        .json()
        .catch(() => ({} as { message?: string; code?: string }));

      if (!res.ok) {
        const msg = (data as any)?.message || "";

        // ưu tiên: tài khoản inactive
        if (
          res.status === 403 ||
          (typeof msg === "string" &&
            /inactive|chưa kích hoạt|not active/i.test(msg)) ||
          (data as any)?.code === "USER_INACTIVE"
        ) {
          setErr(
            "Tài khoản của bạn chưa được kích hoạt, vui lòng liên hệ quản trị viên."
          );
        } else {
          setErr(
            typeof msg === "string" && msg ? msg : "Sai tài khoản hoặc mật khẩu"
          );
        }

        setLoading(false);
        return;
      }

      // login OK
      window.localStorage.setItem("accessToken", data.accessToken);
      window.localStorage.setItem("currentUser", JSON.stringify(data.user));

      window.location.href = "/courses";
    } catch (e) {
      console.error(e);
      setErr("Không kết nối được server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      sx={{
        maxWidth: 400,
        mx: "auto",
        mt: 6,
        boxShadow: 8,
        borderRadius: 3,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Typography
          variant="h2"
          sx={{ mb: 2, fontSize: "1.4rem", fontWeight: 600 }}
        >
          Đăng nhập đào tạo
        </Typography>

        {err && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
        )}

        <form onSubmit={handleLogin}>
          <Stack spacing={2}>
            <TextField
              label="Tên đăng nhập"
              size="small"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="vd: tester_a"
              fullWidth
            />

            <TextField
              label="Mật khẩu"
              size="small"
              fullWidth
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={
                        showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                      }
                      onClick={() =>
                        setShowPassword((prevVisible) => !prevVisible)
                      }
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              variant="contained"
              color="secondary"
              disabled={loading}
              sx={{ fontWeight: 600 }}
            >
              {loading ? "Đang xử lý..." : "Đăng nhập"}
            </Button>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
