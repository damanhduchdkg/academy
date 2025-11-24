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
  Patch,
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
import { UpdateFileDto } from './dto/update-file.dto';

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

  // 2.1. Đăng ký metadata link ngoài
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

  // 2.2. UPLOAD BINARY: POST /admin/files/upload
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadRoot = path.resolve(process.cwd(), 'uploads');
          fs.mkdirSync(uploadRoot, { recursive: true });
          cb(null, uploadRoot);
        },
        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);
          const base = path
            .basename(file.originalname, ext)
            .replace(/[^a-zA-Z0-9-_]/g, '_');

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
    const storageKey = path.relative(uploadRoot, file.path);

    const meta = await this.filesService.registerFile({
      uploaderId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      publicUrl: null,
      byteSize: file.size,
      storageKey,
      storageProvider: 'local',
    });

    const fileUrl = `/files/${meta.id}`;

    return {
      file: meta,
      url: fileUrl,
    };
  }

  // 2.3. Cập nhật file (đổi tên / bật tắt active)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateFileDto) {
    return this.filesService.adminUpdateFile({
      id,
      fileName: dto.file_name,
      isActive: dto.is_active,
    });
  }

  // 2.4. Soft delete file (set is_active = false)
  @Delete(':id')
  async softDelete(@Param('id') id: string) {
    return this.filesService.deactivateFile(id);
  }
}
