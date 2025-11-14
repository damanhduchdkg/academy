"use client";

import { createTheme } from "@mui/material/styles";

// Màu brand của bạn
const PRIMARY = "#0c0269"; // xanh đậm
const ACCENT = "#e10900"; // đỏ nhấn

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: PRIMARY,
      contrastText: "#ffffff",
    },
    secondary: {
      main: ACCENT,
      contrastText: "#ffffff",
    },
    background: {
      default: "#f5f6fa",
      paper: "#ffffff",
    },
  },
  shape: {
    borderRadius: 12, // bo góc mềm, hiện đại
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: "0 12px 32px rgba(0,0,0,0.07)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderRadius: 999,
          boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
        },
      },
    },
  },
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: "1.5rem", fontWeight: 600 },
    h2: { fontSize: "1.25rem", fontWeight: 600 },
    h3: { fontSize: "1.1rem", fontWeight: 600 },
    body1: { fontSize: "0.95rem", lineHeight: 1.5 },
    body2: { fontSize: "0.8rem", lineHeight: 1.4 },
  },
});

export default theme;
