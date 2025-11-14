"use client";

import "./globals.css";
import {
  ThemeProvider,
  CssBaseline,
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Stack,
} from "@mui/material";
import theme from "@/theme";
import { useEffect, useState } from "react";
import Link from "next/link";
// import "@/app/pdf.worker"; // kích hoạt worker cho toàn app

interface CurrentUser {
  id: string;
  full_name: string;
  role: string;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // token lưu từ localStorage
  const [token, setToken] = useState<string | null>(null);
  // thông tin user lấy từ /auth/me
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    // 1. lấy token từ localStorage
    const t = window.localStorage.getItem("accessToken");
    setToken(t);

    // 2. nếu có token → gọi /auth/me để lấy thông tin user
    async function fetchMe() {
      if (!t) {
        setUser(null);
        return;
      }
      try {
        const res = await fetch("http://localhost:3000/auth/me", {
          headers: {
            Authorization: `Bearer ${t}`,
          },
        });

        if (!res.ok) {
          // token hết hạn hoặc lỗi → xoá token, ép logout
          window.localStorage.removeItem("accessToken");
          setToken(null);
          setUser(null);
          return;
        }

        const meData = await res.json();
        // { id, full_name, role } như trong auth.controller.ts
        setUser(meData);

        // option: cache thông tin user vào localStorage nếu muốn xài ở chỗ khác
        window.localStorage.setItem("currentUser", JSON.stringify(meData));
      } catch (err) {
        console.error("Lỗi gọi /auth/me", err);
        // nếu lỗi mạng thì cứ để nguyên token, user=null -> header sẽ không hiện tên
      }
    }

    fetchMe();
  }, []);

  const handleLogout = () => {
    window.localStorage.removeItem("accessToken");
    window.localStorage.removeItem("currentUser");
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  };

  return (
    <html lang="vi">
      <body>
        <ThemeProvider theme={theme}>
          <CssBaseline />

          {/* HEADER */}
          <AppBar position="static" color="primary" elevation={8}>
            <Toolbar
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              {/* LEFT NAV */}
              <Stack direction="row" spacing={3} alignItems="center">
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: "#fff" }}
                >
                  Academy
                </Typography>

                <Stack
                  direction="row"
                  spacing={2}
                  sx={{
                    display: { xs: "none", sm: "flex" },
                    "& a": {
                      color: "#fff",
                      fontSize: "0.9rem",
                      fontWeight: 500,
                      textDecoration: "none",
                      "&:hover": { color: theme.palette.secondary.main },
                    },
                  }}
                >
                  <Link href="/">Home</Link>
                  <Link href="/courses">Đào tạo</Link>
                  <Link href="/noi-quy">Nội quy</Link>
                </Stack>
              </Stack>

              {/* RIGHT AUTH AREA */}
              {token ? (
                <Stack
                  direction="row"
                  spacing={2}
                  alignItems="center"
                  sx={{ color: "#fff" }}
                >
                  {/* Tên user nếu đã load thành công từ /auth/me */}
                  {user ? (
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        color: "#fff",
                        textAlign: "right",
                        lineHeight: 1.2,
                      }}
                    >
                      {/* ví dụ: "Xin chào, Đức (user)" */}
                      Xin chào,{" "}
                      <strong>{user.full_name || "Người dùng"}</strong>
                      <br />
                      <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>
                        {user.role}
                      </span>
                    </Typography>
                  ) : (
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: "0.9rem",
                        fontWeight: 500,
                        color: "#fff",
                      }}
                    >
                      Đang tải...
                    </Typography>
                  )}

                  <Button
                    variant="contained"
                    color="secondary"
                    size="small"
                    onClick={handleLogout}
                    sx={{
                      fontWeight: 600,
                      boxShadow: "0 8px 20px rgba(225,9,0,0.4)",
                      textTransform: "none",
                    }}
                  >
                    Đăng xuất
                  </Button>
                </Stack>
              ) : (
                <Button
                  variant="contained"
                  color="secondary"
                  size="small"
                  onClick={() => (window.location.href = "/login")}
                  sx={{
                    fontWeight: 600,
                    boxShadow: "0 8px 20px rgba(225,9,0,0.4)",
                    textTransform: "none",
                  }}
                >
                  Đăng nhập
                </Button>
              )}
            </Toolbar>
          </AppBar>

          {/* CONTENT WRAPPER */}
          <Box
            component="main"
            sx={{
              maxWidth: 960,
              mx: "auto",
              width: "100%",
              p: 2,
            }}
          >
            {children}
          </Box>
        </ThemeProvider>
      </body>
    </html>
  );
}
