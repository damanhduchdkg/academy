// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // nếu bạn có config khác (images, experimental, ...) thì thêm vào đây

  webpack: (config) => {
    // đảm bảo có object resolve
    if (!config.resolve) {
      config.resolve = {};
    }

    // fallback cho các module Node mà pdfjs đòi hỏi nhưng browser không có
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      path: false,
      crypto: false,
      stream: false,
    };

    // tắt luôn canvas nếu pdfjs cố require
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };

    return config;
  },
};

export default nextConfig;
