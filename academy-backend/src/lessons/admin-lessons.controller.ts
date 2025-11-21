// src/lessons/admin-lessons.controller.ts
import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Get,
  Query,
  Req,
  UseGuards,
  Post,
} from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { AttachFileDto } from './dto/attach-file.dto';
import { AttachYoutubeDto } from './dto/attach-youtube.dto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { RolesGuard } from '../auth/roles.guard';
import {
  AdminCreateLessonDto,
  AdminUpdateLessonDto,
} from '../courses/dto/admin-lesson.dto';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('admin/lessons')
export class AdminLessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  /**
   * GET /admin/lessons
   * GET /admin/lessons?courseId=...&search=...&page=1&pageSize=20
   */
  @Get()
  async listLessons(
    @Query('courseId') courseId?: string,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    return this.lessonsService.listLessonsForAdmin({
      courseId,
      search,
      page: Math.max(1, Number(page)),
      pageSize: Math.min(100, Math.max(1, Number(pageSize))),
    });
  }

  /**
   * Tạo bài học mới
   * POST /admin/lessons
   */
  @Post()
  @Roles(Role.admin, Role.manager)
  async createLesson(@Body() dto: AdminCreateLessonDto) {
    return this.lessonsService.createLessonForAdmin(dto);
  }

  /**
   * Cập nhật bài học
   * PATCH /admin/lessons/:id
   */
  @Patch(':id')
  @Roles(Role.admin, Role.manager)
  async updateLesson(
    @Param('id') id: string,
    @Body() dto: AdminUpdateLessonDto,
  ) {
    return this.lessonsService.updateLessonForAdmin(id, dto);
  }

  /**
   * Xoá bài học
   * DELETE /admin/lessons/:id
   */
  @Delete(':id')
  @Roles(Role.admin, Role.manager)
  async deleteLesson(@Param('id') id: string) {
    return this.lessonsService.deleteLessonForAdmin(id);
  }

  /**
   * Gắn file (PDF / video) cho bài học
   * PATCH /admin/lessons/:id/attach-file
   * body: { "fileId": "..." }
   */
  @Patch(':id/attach-file')
  @Roles(Role.admin, Role.manager)
  async attachFile(
    @Req() req: any,
    @Param('id') lessonId: string,
    @Body() body: AttachFileDto,
  ) {
    const userId = req.user.user_id;

    return this.lessonsService.attachFileToLesson({
      lessonId,
      fileId: body.fileId,
      userId,
    });
  }

  /**
   * Gỡ file ra khỏi bài học (unlink)
   * DELETE /admin/lessons/:id/attach-file
   */
  @Delete(':id/attach-file')
  @Roles(Role.admin, Role.manager)
  async detachFile(@Param('id') lessonId: string) {
    return this.lessonsService.detachFileFromLesson(lessonId);
  }

  /**
   * Gắn link YouTube
   * PATCH /admin/lessons/:id/youtube
   * body: { "youtubeUrl": "https://youtu.be/..." }
   */
  @Patch(':id/youtube')
  @Roles(Role.admin, Role.manager)
  async attachYoutube(
    @Param('id') lessonId: string,
    @Body() body: AttachYoutubeDto,
  ) {
    return this.lessonsService.attachYoutubeToLesson({
      lessonId,
      youtubeUrl: body.youtubeUrl,
    });
  }

  /**
   * Gỡ link YouTube
   * DELETE /admin/lessons/:id/youtube
   */
  @Delete(':id/youtube')
  @Roles(Role.admin, Role.manager)
  async detachYoutube(@Param('id') lessonId: string) {
    return this.lessonsService.detachYoutubeFromLesson(lessonId);
  }
}
