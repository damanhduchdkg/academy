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
// import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
// import "@/app/pdf.worker"; // kích hoạt worker cho toàn app

interface CurrentUser {
  id: string;
  full_name: string;
  role: string;
}

function TopNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href); // để /courses, /noi-quy active đúng

  return (
    <Button
      onClick={() => router.push(href)}
      sx={{
        textTransform: "none",
        fontSize: "0.9rem",
        fontWeight: 500,
        color: "#fff",
        minWidth: "auto",
        p: 0,
        "&:hover": {
          color: "#ffd700",
          background: "transparent",
        },
        ...(isActive
          ? { borderBottom: "2px solid #ffd700", borderRadius: 0 }
          : {}),
      }}
    >
      {children}
    </Button>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/";
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
              <Stack direction="row" spacing={2} alignItems="center">
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: "#fff", mr: 2 }}
                >
                  Academy
                </Typography>

                {/* Nhóm tab */}
                <Stack
                  direction="row"
                  spacing={1.5}
                  sx={{
                    display: { xs: "none", sm: "flex" },
                  }}
                >
                  {[
                    { label: "Home", href: "/" },
                    { label: "Đào tạo", href: "/courses" },
                    { label: "Nội quy", href: "/noi-quy" },
                    // Admin chỉ hiện khi là admin/manager
                    ...(user &&
                    (user.role === "admin" || user.role === "manager")
                      ? [{ label: "Admin", href: "/admin" }]
                      : []),
                  ].map((item) => {
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/"); // vd /courses/abc vẫn active "Đào tạo"

                    return (
                      <Button
                        key={item.href}
                        onClick={() => (window.location.href = item.href)}
                        variant="text"
                        sx={{
                          textTransform: "none",
                          fontSize: "0.9rem",
                          fontWeight: 600,
                          minWidth: "auto",
                          px: 2.5,
                          py: 0.7,
                          borderRadius: 999,

                          // màu chữ + nền khi active
                          color: active ? theme.palette.primary.main : "#fff",
                          backgroundColor: active ? "#ffffff" : "transparent",
                          boxShadow: active
                            ? "0 6px 18px rgba(0,0,0,0.18)"
                            : "none",

                          // HOVER giống screenshot: nền nhẹ, chữ vẫn rõ
                          "&:hover": {
                            backgroundColor: active
                              ? "#ffffff"
                              : "rgba(255,255,255,0.18)",
                            color: active ? theme.palette.primary.main : "#fff",
                          },

                          // FOCUS (tab bằng bàn phím) – viền mờ
                          "&:focus-visible": {
                            outline: "2px solid rgba(255,255,255,0.8)",
                            outlineOffset: 2,
                          },
                        }}
                      >
                        {item.label}
                      </Button>
                    );
                  })}
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
              // maxWidth: 1280,
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
