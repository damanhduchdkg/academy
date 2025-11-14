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
} from "@mui/material";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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

      if (!res.ok) {
        setErr("Sai tài khoản hoặc mật khẩu");
        setLoading(false);
        return;
      }

      const data = await res.json();
      window.localStorage.setItem("accessToken", data.accessToken);
      window.localStorage.setItem("currentUser", JSON.stringify(data.user));

      window.location.href = "/courses";
    } catch (e) {
      setErr("Không kết nối được server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card sx={{ maxWidth: 400, mx: "auto", mt: 4 }}>
      <CardContent>
        <Typography variant="h2" sx={{ mb: 2 }}>
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
              type="password"
              size="small"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              fullWidth
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
