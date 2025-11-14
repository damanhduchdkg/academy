import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { FilesService } from './files.service';
import * as fs from 'fs';
import * as path from 'path';

/* ====== Kiểu meta cũ/mới ====== */
type MetaOld = {
  id: string;
  created_at: Date;
  file_name: string;
  file_type?: string;
  storage_path?: string; // có thể là 'docs/demo.pdf' hoặc URL
  is_private?: boolean;
  is_active: boolean;
};

type MetaNew = {
  id: string;
  created_at: Date;
  file_name: string;
  mime_type?: string;
  storage_key?: string; // có thể là 'docs/demo.pdf'
  public_url?: string | null; // URL ngoài
  is_active: boolean;
};

type FileMeta = MetaOld | MetaNew;

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /* Ping nhanh */
  @Get('ping')
  ping() {
    return { ok: true, at: 'files' };
  }

  /* Debug nhanh meta + đường dẫn thực tế */
  @Get(':fileId/_debug')
  async debug(@Param('fileId') fileId: string) {
    const raw = (await this.filesService.getFileMeta(
      fileId,
    )) as FileMeta | null;
    if (!raw) throw new NotFoundException('No meta');

    const external = this.pickExternalUrl(raw);
    const mime = this.detectMime(raw);
    const abs = this.resolveLocalPath(raw);
    const exists = abs && !this.isUrl(abs) && fs.existsSync(abs);
    const stat = exists ? fs.statSync(abs) : null;

    return { raw, external, mime, absPath: abs, exists, stat };
  }

  /**
   * GET /files/:fileId
   * - URL ngoài -> 302 redirect
   * - File nội bộ -> stream (video hỗ trợ Range; pdf inline)
   */
  @Get(':fileId')
  async getFile(
    @Param('fileId') fileId: string,
    @Res() res: Response,
    @Query('token') _token?: string, // chừa sẵn nếu sau này muốn verify qua query
  ) {
    const meta = (await this.filesService.getFileMeta(
      fileId,
    )) as FileMeta | null;
    if (!meta || meta.is_active === false) {
      throw new NotFoundException('File not found');
    }

    // 1) URL ngoài -> redirect
    const external = this.pickExternalUrl(meta);
    if (external) return res.redirect(external);

    // 2) Xác định mime + đường dẫn vật lý
    const mime = this.detectMime(meta);
    const absPath = this.resolveLocalPath(meta);
    if (!absPath || this.isUrl(absPath) || !fs.existsSync(absPath)) {
      throw new NotFoundException('File content not found');
    }

    // 3) Header chung
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range',
    );
    // Quan trọng: bỏ X-Frame-Options và set CSP cho phép trang FE nhúng
    res.removeHeader('X-Frame-Options');
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        // cho phép trang FE nhúng file này qua iframe
        "frame-ancestors 'self' http://localhost:3001 http://localhost:* http://192.168.0.113:3001 http://192.168.0.113:*",
      ].join('; '),
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 4) Stream theo loại
    if (mime.startsWith('video/')) {
      return this.streamVideoWithRange(absPath, res);
    }

    // ... trong FilesController.getFile() nhánh PDF
    if (mime === 'application/pdf') {
      const stat = fs.statSync(absPath);

      // CHO PHÉP BÊN NGOÀI NHÚNG IFRAME (FE của bạn)
      const allowFrames = [
        'http://localhost:3001',
        'http://192.168.0.113:3001',
      ].join(' ');
      res.setHeader(
        'Content-Security-Policy',
        `frame-ancestors 'self' ${allowFrames}`,
      );

      res.setHeader(
        'Content-Disposition',
        `inline; filename="${sanitizeFileName((meta as any).file_name)}"`,
      );
      res.setHeader('Content-Length', String(stat.size));
      return fs
        .createReadStream(absPath)
        .on('error', () => res.destroy())
        .pipe(res);
    }

    // Mặc định: octet-stream
    const stat = fs.statSync(absPath);
    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(absPath)
      .on('error', () => res.destroy())
      .pipe(res);
  }

  /* ================= Helpers ================= */

  /** Ưu tiên public_url; nếu storage_key/storage_path đã là URL thì dùng luôn */
  private pickExternalUrl(meta: FileMeta): string | null {
    const mNew = meta as MetaNew;
    if (mNew.public_url && this.isUrl(mNew.public_url)) return mNew.public_url;

    const mOld = meta as MetaOld;
    if (
      mOld.file_type === 'youtube' &&
      mOld.storage_path &&
      this.isUrl(mOld.storage_path)
    ) {
      return mOld.storage_path;
    }

    const key = (mNew.storage_key ?? mOld.storage_path) || '';
    if (this.isUrl(key)) return key;

    return null;
  }

  private isUrl(u: string | null | undefined): u is string {
    if (!u) return false;
    try {
      const x = new URL(u);
      return !!x.protocol && !!x.hostname;
    } catch {
      return false;
    }
  }

  private detectMime(meta: FileMeta): string {
    const mNew = meta as MetaNew;
    if (mNew.mime_type) return mNew.mime_type.toLowerCase();

    const mOld = meta as MetaOld;
    const ft = (mOld.file_type || '').toLowerCase();
    if (ft === 'mp4') return 'video/mp4';
    if (ft === 'mov') return 'video/quicktime';
    if (ft === 'webm') return 'video/webm';
    if (ft === 'pdf') return 'application/pdf';
    if (ft === 'youtube') return 'text/html';

    const guessFrom = (
      mNew.storage_key ||
      mOld.storage_path ||
      mOld.file_name ||
      ''
    ).split('?')[0];
    const ext = guessFrom.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'mp4':
        return 'video/mp4';
      case 'mov':
        return 'video/quicktime';
      case 'webm':
        return 'video/webm';
      case 'pdf':
        return 'application/pdf';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      default:
        return 'application/octet-stream';
    }
  }

  /**
   * Map key (cho phép thư mục con) vào ./uploads một cách an toàn.
   * Ví dụ key = "docs/demo.pdf" -> <project>/uploads/docs/demo.pdf
   * Chặn path traversal ("../") và không cho thoát ra ngoài uploads/.
   */
  private resolveLocalPath(meta: FileMeta): string {
    const mNew = meta as MetaNew;
    const mOld = meta as MetaOld;
    let rel = (mNew.storage_key ?? mOld.storage_path) || '';

    // Nếu là URL → trả nguyên (caller sẽ 404)
    if (this.isUrl(rel)) return rel;

    // Chuẩn hoá, bỏ leading slash, chặn ../
    rel = path.normalize(rel).replace(/^([/\\])+/, '');
    if (rel.startsWith('..')) throw new NotFoundException('Invalid file path');

    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const abs = path.resolve(uploadsRoot, rel);

    // Không cho thoát ra ngoài uploads/
    if (!abs.startsWith(uploadsRoot))
      throw new NotFoundException('Invalid file path');

    return abs;
  }

  private streamVideoWithRange(absPath: string, res: Response) {
    const stat = fs.statSync(absPath);
    const size = stat.size;
    const rangeHeader = (res.req.headers.range || '').toString();

    if (rangeHeader) {
      const m = /bytes=(\d*)-(\d*)/i.exec(rangeHeader);
      if (!m) throw new BadRequestException('Malformed Range header');

      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? parseInt(m[2], 10) : size - 1;

      if (isNaN(start) || isNaN(end) || start > end || end >= size) {
        res.setHeader('Content-Range', `bytes */${size}`);
        return res.status(416).end();
      }

      res.status(206);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', String(end - start + 1));
      return fs
        .createReadStream(absPath, { start, end })
        .on('error', () => res.destroy())
        .pipe(res);
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(size));
    fs.createReadStream(absPath)
      .on('error', () => res.destroy())
      .pipe(res);
  }
}

function sanitizeFileName(name: string | undefined): string {
  if (!name) return 'file';
  return name.replace(/[/\\?%*:|"<>]/g, '_');
}
