"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
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

export default function AdminFilesSection() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [resp, setResp] = useState<AdminFilesResponse | null>(null);

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

  if (err) {
    return (
      <Card
        sx={{
          borderRadius: 3,
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
            Quản lý file
          </Typography>
          <Alert severity="error" sx={{ mb: 2 }}>
            {err}
          </Alert>
          <Button variant="outlined" onClick={loadFiles}>
            Thử lại
          </Button>
        </CardContent>
      </Card>
    );
  }

  const items = resp?.data ?? [];

  return (
    <Card
      sx={{
        borderRadius: 3,
        boxShadow: "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
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
          {/* nút upload file đã có chỗ khác (modal / trang riêng) */}
          <Button
            variant="contained"
            sx={{ borderRadius: 999, textTransform: "none" }}
            onClick={() => {
              // TODO: mở dialog upload FE sau
            }}
          >
            Upload file
          </Button>
        </Box>

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
                <th style={{ width: 40, fontWeight: "bold", fontSize: "1rem" }}>
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
  );
}
