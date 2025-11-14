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
}
