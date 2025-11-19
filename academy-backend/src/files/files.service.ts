import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Service này chỉ là ví dụ. Bạn cần sửa theo cách thật sự bạn lưu file:
 * - Nếu bạn lưu file trong S3 => ở đây sẽ generate signed URL S3 thay vì đọc fs.
 * - Nếu bạn lưu file local => đọc từ ổ đĩa rồi stream ra.
 */
@Injectable()
export class FilesService {
  constructor(private prisma: PrismaService) {}

  async getFileMeta(fileId: string) {
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
  }

  /**
   * Ví dụ nếu bạn đang lưu file thật trong thư mục ./uploads/<storage_path>
   * và muốn stream nó về response (video/pdf/...).
   * Nếu bạn dùng S3 thì thay logic này = generate signed URL rồi trả redirect.
   */
  createLocalFileStream(storagePath: string) {
    const absPath = path.resolve(process.cwd(), 'uploads', storagePath);
    if (!fs.existsSync(absPath)) {
      return null;
    }
    return fs.createReadStream(absPath);
  }
  // Đăng ký metadata file (admin upload thủ công hoặc link có sẵn)
  async registerFile(params: {
    uploaderId: string;
    fileName: string;
    mimeType: string;
    publicUrl?: string | null; // link ngoài (nếu có)
    byteSize?: number;
    storageKey?: string | null; // đường dẫn tương đối trong thư mục uploads
    storageProvider?: string | null; // 'local' | 'external' | ...
  }) {
    const {
      uploaderId,
      fileName,
      mimeType,
      publicUrl,
      byteSize,
      storageKey,
      storageProvider,
    } = params;

    const isExternal = !!publicUrl;

    const file = await this.prisma.file.create({
      data: {
        file_name: fileName,
        mime_type: mimeType,
        public_url: publicUrl ?? null,
        uploaded_by: uploaderId,
        storage_provider:
          storageProvider ?? (isExternal ? 'external' : 'local'),
        storage_key: storageKey ?? publicUrl ?? fileName,
        byte_size: byteSize ?? 0,
        is_active: true,
      },
      select: {
        id: true,
        file_name: true,
        mime_type: true,
        public_url: true,
        is_active: true,
        created_at: true,
      },
    });

    return file;
  }

  // Xoá mềm file (ẩn khỏi hệ thống)
  async deactivateFile(fileId: string) {
    await this.prisma.file.update({
      where: { id: fileId },
      data: { is_active: false },
      select: {
        id: true,
        file_name: true,
        is_active: true,
      },
    });
    return { ok: true };
  }

  async adminList(params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const skip = (page - 1) * pageSize;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.file.findMany({
        skip,
        take: pageSize,
        where: {},
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          file_name: true,
          mime_type: true,
          public_url: true,
          byte_size: true,
          is_active: true,
          created_at: true,
        },
      }),
      this.prisma.file.count(),
    ]);

    return [rows, total] as const;
  }
}
