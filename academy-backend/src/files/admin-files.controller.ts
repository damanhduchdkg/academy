import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Get,
  Query,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { RegisterFileDto } from './dto/register-file.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { RolesGuard } from '../auth/roles.guard';

import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.admin, Role.manager)
@Controller('admin/files')
export class AdminFilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  async list(@Query('page') page = '1', @Query('pageSize') pageSize = '50') {
    const pageNum = Number(page) || 1;
    const sizeNum = Number(pageSize) || 50;

    const [data, total] = await this.filesService.adminList({
      page: pageNum,
      pageSize: sizeNum,
    });

    return {
      page: pageNum,
      pageSize: sizeNum,
      total,
      data,
    };
  }

  // ====== 2.1. Đăng ký metadata link ngoài (đã có sẵn) ======
  @Post('register')
  async register(@Req() req: any, @Body() dto: RegisterFileDto) {
    const uploaderId = req.user.user_id;

    return this.filesService.registerFile({
      uploaderId,
      fileName: dto.file_name,
      mimeType: dto.mime_type,
      publicUrl: dto.public_url,
      byteSize: dto.byte_size ?? 0,
    });
  }

  // ====== 2.2. UPLOAD BINARY: POST /admin/files/upload ======
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadRoot = path.resolve(process.cwd(), 'uploads');
          // đảm bảo thư mục tồn tại
          fs.mkdirSync(uploadRoot, { recursive: true });
          cb(null, uploadRoot);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname); // .pdf
          const base = path
            .basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9-_]/g, '_'); // tránh ký tự lạ

          const unique = Date.now();
          cb(null, `${unique}_${base}${ext}`);
        },
      }),
    }),
  )
  async uploadFile(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const uploaderId = req.user.user_id;

    const uploadRoot = path.resolve(process.cwd(), 'uploads');
    // file.path là absolute path, convert về relative để lưu storage_key
    const storageKey = path.relative(uploadRoot, file.path);

    const meta = await this.filesService.registerFile({
      uploaderId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      publicUrl: null, // file nội bộ
      byteSize: file.size,
      storageKey, // ví dụ: '1710345678_demo.pdf'
      storageProvider: 'local',
    });

    // URL FE dùng để mở file
    const fileUrl = `/files/${meta.id}`;

    return {
      file: meta,
      url: fileUrl,
    };
  }

  // ====== 2.3. Soft delete file ======
  @Delete(':id')
  async softDelete(@Param('id') id: string) {
    return this.filesService.deactivateFile(id);
  }
}
