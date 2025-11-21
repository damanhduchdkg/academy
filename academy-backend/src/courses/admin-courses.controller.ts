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
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { LessonsService } from '../lessons/lessons.service';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('admin/courses')
export class AdminCoursesController {
  constructor(
    private readonly coursesService: CoursesService,
    private readonly lessonsService: LessonsService,
  ) {}

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

  // GET /admin/courses/:id/lessons
  @Get(':id/lessons')
  async listLessonsOfCourse(
    @Param('id') courseId: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '200',
  ) {
    const result = await this.lessonsService.listLessonsForAdmin({
      courseId,
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.min(200, Math.max(1, Number(pageSize) || 200)),
    });

    // FE AdminCourseLessonsSection đang:
    // const rows = Array.isArray(res) ? res : res.data || [];
    // nên trả thẳng mảng để FE bắt được luôn
    return result.data;
  }

  // POST /admin/courses  (Admin tạo khoá học)
  @Post()
  @Roles(Role.admin, Role.manager)
  async create(@Req() req: any, @Body() dto: Partial<CreateCourseDto>) {
    const adminUserId = req.user?.user_id ?? 'admin';
    return this.coursesService.createCourseForAdmin(adminUserId, dto as any);
  }

  // PATCH /admin/courses/:id  (Admin cập nhật khoá học)
  @Patch(':id')
  @Roles(Role.admin, Role.manager)
  async update(@Param('id') id: string, @Body() dto: Partial<UpdateCourseDto>) {
    return this.coursesService.updateCourseForAdmin(id, dto as any);
  }

  // DELETE /admin/courses/:id  (Admin xoá khoá học)
  @Delete(':id')
  @Roles(Role.admin, Role.manager)
  async delete(@Param('id') id: string) {
    return this.coursesService.deleteCourseByAdmin(id);
  }

  // POST /admin/courses/:id/toggle-status  (active / inactive)
  @Post(':id/toggle-status')
  @Roles(Role.admin, Role.manager)
  async toggleStatus(@Param('id') id: string) {
    return this.coursesService.togglePublishStatus(id);
  }

  /**
   * Gán khoá học cho user
   * POST /admin/courses/:id/assign-user
   * body: { "userId": "..." }
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
