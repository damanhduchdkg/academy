// src/courses/admin-courses.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Controller('admin/courses')
export class AdminCoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // GET /admin/courses
  @Get()
  async list(@Query('page') page = '1', @Query('pageSize') pageSize = '10') {
    const pageNum = Number(page) || 1;
    const sizeNum = Number(pageSize) || 10;

    const result = await this.coursesService.adminList({
      page: pageNum,
      pageSize: sizeNum,
    });

    return {
      ...result,
      page: pageNum,
      pageSize: sizeNum,
    };
  }

  // POST /admin/courses  (Admin tạo khoá học)
  @Post()
  async create(@Req() req: any, @Body() dto: Partial<CreateCourseDto>) {
    const adminUserId = req.user?.user_id ?? 'admin';
    return this.coursesService.createCourseForAdmin(adminUserId, dto as any);
  }

  // PATCH /admin/courses/:id  (Admin cập nhật khoá học)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<UpdateCourseDto>) {
    return this.coursesService.updateCourseForAdmin(id, dto as any);
  }

  // DELETE /admin/courses/:id  (Admin xoá khoá học)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.coursesService.deleteCourseByAdmin(id);
  }

  // POST /admin/courses/:id/toggle-status  (active / inactive)
  @Post(':id/toggle-status')
  async toggleStatus(@Param('id') id: string) {
    return this.coursesService.togglePublishStatus(id);
  }

  /**
   * Gán khoá học cho user
   * POST /admin/courses/:id/assign-user
   * body: { "userId": "..." }
   *
   * Chỉ admin & manager được dùng
   */
  @Post(':id/assign-user')
  @Roles(Role.admin, Role.manager)
  assignUserToCourse(
    @Param('id') courseId: string,
    @Body('userId') userId: string,
  ) {
    return this.coursesService.assignUserToCourse(courseId, userId);
  }

  /**
   * Bỏ gán khoá học khỏi user
   * DELETE /admin/courses/:id/assign-user/:userId
   */
  @Delete(':id/assign-user/:userId')
  @Roles(Role.admin, Role.manager)
  unassignUserFromCourse(
    @Param('id') courseId: string,
    @Param('userId') userId: string,
  ) {
    return this.coursesService.unassignUserFromCourse(courseId, userId);
  }
}
