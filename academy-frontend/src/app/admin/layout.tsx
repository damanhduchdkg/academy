"use client";

import type { ReactNode } from "react";
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import { usePathname } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";

const NAV_ITEMS = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/users", label: "Quản lý user" },
  { href: "/admin/courses", label: "Quản lý khoá học" },
  { href: "/admin/files", label: "Quản lý file" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuthGuard({
    requiredRoles: ["admin", "manager"],
  });

  const pathname = usePathname() || "/";

  if (loading) return null;
  if (!user) return null;

  const handleNavClick = (href: string) => {
    if (typeof window === "undefined") return;
    if (href === pathname) return; // đang ở đúng trang rồi thì thôi
    window.location.href = href; // full reload cho chắc
  };

  return (
    <Box
      sx={{
        mx: "auto",
        mt: 3,
        px: 2,
        display: "flex",
        gap: 3,
      }}
    >
      {/* SIDEBAR */}
      <Box sx={{ width: 260 }}>
        <Box
          sx={{
            borderRadius: 3,
            p: 2,
            backgroundColor: "#fff",
            boxShadow:
              "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
          }}
        >
          <Typography sx={{ fontWeight: 600 }}>Admin Dashboard</Typography>
          <Typography sx={{ color: "#666", fontSize: 12, mb: 2 }}>
            Xin chào {user.full_name} ({user.role})
          </Typography>

          <List disablePadding>
            {NAV_ITEMS.map((item) => {
              const isRoot = item.href === "/admin";

              // ✅ Tổng quan chỉ active đúng /admin
              const active = isRoot
                ? pathname === "/admin"
                : pathname === item.href ||
                  pathname.startsWith(item.href + "/");

              return (
                <ListItemButton
                  key={item.href}
                  component="button"
                  onClick={() => handleNavClick(item.href)}
                  selected={active}
                  disableGutters
                  sx={{
                    width: "100%",
                    borderRadius: "999px",
                    mb: 1,
                    px: 2,
                    justifyContent: "flex-start",
                    textAlign: "left",
                    // màu bình thường
                    backgroundColor: "#ffffff",
                    color: "#000000",
                    "&:hover": {
                      backgroundColor: "rgba(2,0,107,0.08)",
                    },
                    // màu khi ACTIVE (đúng như bạn muốn)
                    "&.Mui-selected": {
                      backgroundColor: "#02006b",
                      color: "#ffffff",
                      boxShadow: "0 10px 25px rgba(15,23,42,0.35)",
                      "&:hover": {
                        backgroundColor: "#00004d",
                      },
                    },
                    "&.Mui-focusVisible": {
                      outline: "2px solid rgba(2,0,107,0.5)",
                      outlineOffset: 2,
                    },
                  }}
                >
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      sx: { fontSize: "0.9rem", fontWeight: 500 },
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>
      </Box>

      {/* MAIN CONTENT */}
      <Box sx={{ flexGrow: 1 }}>{children}</Box>
    </Box>
  );
}
