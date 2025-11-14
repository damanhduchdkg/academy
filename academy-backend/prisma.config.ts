import 'dotenv/config'; // <- dòng này bắt buộc để nạp .env
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // dùng engine "classic" (chuẩn Postgres)
  engine: 'classic',

  // đường dẫn tới schema prisma chính
  schema: path.join('prisma', 'schema.prisma'),

  // nơi Prisma sẽ tạo migrations
  migrations: {
    path: path.join('prisma', 'migrations'),
  },

  // datasource: lấy URL kết nối DB từ biến môi trường
  datasource: {
    // đây chính là DATABASE_URL trong .env
    url: env<{
      DATABASE_URL: string;
    }>('DATABASE_URL'),
  },
});
