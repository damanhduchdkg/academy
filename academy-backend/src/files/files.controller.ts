// src/files/files.controller.ts
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
import * as fs from 'fs';
import * as path from 'path';
import { FilesService } from './files.service';
import { Public } from '@/auth/public.decorator';

type MetaNew = {
  id: string;
  created_at: Date;
  file_name: string;
  mime_type?: string | null;
  storage_key?: string | null;
  public_url?: string | null;
  is_active: boolean;
};

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get('ping')
  ping() {
    return { ok: true, at: 'files' };
  }

  @Get(':fileId/_debug')
  async debug(@Param('fileId') fileId: string) {
    const meta = (await this.filesService.getFileMeta(
      fileId,
    )) as MetaNew | null;
    if (!meta) throw new NotFoundException('No meta');

    const absPath = this.resolveLocalPath(meta);
    const exists = absPath && fs.existsSync(absPath);
    const stat = exists ? fs.statSync(absPath) : null;

    return { meta, absPath, exists, stat };
  }

  /**
   * GET /files/:fileId
   *  - File local: stream (video hỗ trợ Range)
   *  - public_url: redirect
   */
  @Public()
  @Get(':fileId')
  async getFile(
    @Param('fileId') fileId: string,
    @Res() res: Response,
    @Query('token') _token?: string,
  ) {
    // 🔥 FIX CHROME ORB / CORS / cross-origin media
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const meta = (await this.filesService.getFileMeta(
      fileId,
    )) as MetaNew | null;

    if (!meta || meta.is_active === false) {
      throw new NotFoundException('File not found');
    }

    if (meta.public_url && this.isUrl(meta.public_url)) {
      return res.redirect(meta.public_url);
    }

    const mime = this.detectMime(meta);
    const absPath = this.resolveLocalPath(meta);

    if (!absPath || !fs.existsSync(absPath)) {
      throw new NotFoundException('File content not found');
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range',
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (mime.startsWith('video/')) {
      return this.streamVideoWithRange(absPath, mime, res);
    }

    if (mime === 'application/pdf') {
      const stat = fs.statSync(absPath);
      res.setHeader('Content-Type', mime);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${sanitizeFileName(meta.file_name)}"`,
      );
      res.setHeader('Content-Length', String(stat.size));
      return fs.createReadStream(absPath).pipe(res);
    }

    const stat = fs.statSync(absPath);
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', String(stat.size));
    return fs.createReadStream(absPath).pipe(res);
  }

  // ========= Helpers =========

  private isUrl(u?: string | null): u is string {
    if (!u) return false;
    try {
      const x = new URL(u);
      return !!x.protocol && !!x.hostname;
    } catch {
      return false;
    }
  }

  private detectMime(meta: MetaNew): string {
    if (meta.mime_type) return meta.mime_type.toLowerCase();

    const guessFrom = (meta.storage_key || meta.file_name || '').split('?')[0];
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

  private resolveLocalPath(meta: MetaNew): string {
    let rel = meta.storage_key || '';

    // nếu lỡ lưu storage_key là URL thì trả nguyên chuỗi (sẽ fail ở exists check)
    if (this.isUrl(rel)) return rel;

    rel = path.normalize(rel).replace(/^([/\\])+/, '');
    if (rel.startsWith('..')) throw new NotFoundException('Invalid file path');

    const uploadsRoot = path.resolve(process.cwd(), 'uploads');
    const abs = path.resolve(uploadsRoot, rel);

    if (!abs.startsWith(uploadsRoot)) {
      throw new NotFoundException('Invalid file path');
    }
    return abs;
  }

  private streamVideoWithRange(absPath: string, mime: string, res: Response) {
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
      res.setHeader('Content-Type', mime);

      return fs
        .createReadStream(absPath, { start, end })
        .on('error', () => res.destroy())
        .pipe(res);
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(size));
    res.setHeader('Content-Type', mime);

    return fs
      .createReadStream(absPath)
      .on('error', () => res.destroy())
      .pipe(res);
  }
}

function sanitizeFileName(name: string | undefined): string {
  if (!name) return 'file';
  let safe = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  safe = safe.replace(/[^\x20-\x7E]/g, '_');
  safe = safe.replace(/[/\\?%*:|"<>]/g, '_');
  if (!safe.trim()) safe = 'file';
  return safe;
}
