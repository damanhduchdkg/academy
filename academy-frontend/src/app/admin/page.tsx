"use client";

import { Box, Card, CardContent, Typography } from "@mui/material";

export default function AdminHomePage() {
  return (
    <Box>
      <Card
        sx={{
          borderRadius: 3,
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.06), 0 8px 16px rgba(0,0,0,0.04)",
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            Tổng quan hệ thống
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontSize: "0.9rem" }}
          >
            Đây là khu vực quản trị khoá học, bài học, user và file. Chọn menu
            bên trái để thao tác từng phần.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
