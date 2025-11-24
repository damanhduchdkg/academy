"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Snackbar,
  Typography,
} from "@mui/material";
import { authFetch } from "@/lib/authFetch";

type AdminFileItem = {
  id: string;
  file_name: string;
  mime_type: string;
  public_url: string | null;
  byte_size?: number | null;
  is_active: boolean;
  created_at: string;
};

type AdminFilesResponse = {
  page: number;
  pageSize: number;
  total: number;
  data: AdminFileItem[];
};

type ToastState = {
  message: string;
  type: "success" | "error";
} | null;

export default function AdminFilesSection() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [resp, setResp] = useState<AdminFilesResponse | null>(null);

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [toast, setToast] = useState<ToastState>(null);

  async function loadFiles() {
    try {
      setLoading(true);
      const data: AdminFilesResponse = await authFetch(
        "/admin/files?page=1&pageSize=50",
        { method: "GET" }
      );
      setResp(data);
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || "Không tải được danh sách file");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles();
  }, []);

  const handleClickUploadButton = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = async (
    e
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setErr(null);

      const form = new FormData();
      form.append("file", file);

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;

      const res = await fetch(
        `${
          process.env.NEXT_PUBLIC_API ?? "http://localhost:3000"
        }/admin/files/upload`,
        {
          method: "POST",
          body: form,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ message: `HTTP ${res.status}` }));
        const msg =
          (body && (body.message || body.error)) ||
          `HTTP ${res.status}: ${res.statusText}`;
        throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
      }

      // Upload ok
      setToast({
        type: "success",
        message: `Upload file "${file.name}" thành công`,
      });

      await loadFiles();
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Upload file thất bại");
      setToast({
        type: "error",
        message: e?.message || "Upload file thất bại",
      });
    } finally {
      setUploading(false);
      // reset input để lần sau chọn lại cùng 1 file vẫn trigger onChange
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (loading) {
    return (
      <Card
        sx={{
          borderRadius: 3,
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
        }}
      >
        <CardContent sx={{ p: 3, textAlign: "center" }}>
          <CircularProgress size={24} />
          <Typography sx={{ mt: 1, fontSize: "0.9rem" }}>
            Đang tải danh sách file...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const items = resp?.data ?? [];

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
          <Box
            sx={{
              mb: 2,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 600 }}>
              Quản lý file
            </Typography>

            <Button
              variant="contained"
              sx={{ borderRadius: 999, textTransform: "none" }}
              onClick={handleClickUploadButton}
              disabled={uploading}
            >
              {uploading ? "Đang upload..." : "Upload file"}
            </Button>
          </Box>

          {err && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {err}
            </Alert>
          )}

          {items.length === 0 ? (
            <Alert severity="info">Chưa có file nào được đăng ký.</Alert>
          ) : (
            <Box
              component="table"
              sx={{
                width: "100%",
                borderCollapse: "collapse",
                "& th, & td": {
                  borderBottom: "1px solid #eee",
                  fontSize: "0.9rem",
                  py: 1,
                  px: 1.5,
                },
                "& th": {
                  textAlign: "left",
                  color: "#666",
                  fontWeight: 500,
                },
              }}
            >
              <thead>
                <tr>
                  <th
                    style={{
                      width: 40,
                      fontWeight: "bold",
                      fontSize: "1rem",
                    }}
                  >
                    #
                  </th>
                  <th style={{ fontWeight: "bold", fontSize: "1rem" }}>
                    Tên file
                  </th>
                  <th style={{ fontWeight: "bold", fontSize: "1rem" }}>Loại</th>
                  <th style={{ fontWeight: "bold", fontSize: "1rem" }}>
                    Kích thước
                  </th>
                  <th style={{ fontWeight: "bold", fontSize: "1rem" }}>
                    Trạng thái
                  </th>
                  <th style={{ fontWeight: "bold", fontSize: "1rem" }}>
                    Tạo lúc
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((f, idx) => (
                  <tr key={f.id}>
                    <td>{idx + 1}</td>
                    <td>{f.file_name}</td>
                    <td>{f.mime_type}</td>
                    <td>
                      {f.byte_size
                        ? `${(f.byte_size / 1024).toFixed(1)} KB`
                        : "-"}
                    </td>
                    <td>{f.is_active ? "active" : "inactive"}</td>
                    <td>{new Date(f.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* input file ẩn */}
      <label htmlFor="admin-upload-file" className="visually-hidden">
        {/* Chọn file để upload */}
      </label>
      <input
        id="admin-upload-file"
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Toast */}
      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setToast(null)}
          severity={toast?.type ?? "success"}
          sx={{ width: "100%" }}
          variant="filled"
        >
          {toast?.message ?? ""}
        </Alert>
      </Snackbar>
    </>
  );
}
