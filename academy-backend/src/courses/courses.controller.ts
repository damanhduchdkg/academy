import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  NotFoundException,
  Body,
  Post,
  Query,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../admin/admin.guard';
import { CreateCourseDto } from './dto/create-course.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  // GET /courses?search=...&page=1&pageSize=10
  @Get()
  async list(
    @Req() req: any,
    @Query('search') search?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '10',
  ) {
    const userId = req.user.user_id;
    const role = req.user.role;

    return this.coursesService.searchCoursesForUser({
      userId,
      role,
      search,
      page: Math.max(1, Number(page)),
      pageSize: Math.min(50, Math.max(1, Number(pageSize))),
    });
  }

  // GET /courses/:id
  @Get(':id')
  async detail(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.user_id;
    const role = req.user.role;

    const data = await this.coursesService.getCourseDetailForUser(
      id,
      userId,
      role,
    );

    if (!data) {
      throw new NotFoundException('Course not found or not allowed');
    }
    return data;
  }

  // POST /courses/admin/courses
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('/admin/courses')
  async createCourse(@Req() req: any, @Body() body: CreateCourseDto) {
    const adminUserId = req.user.user_id;
    return this.coursesService.createCourseForAdmin(adminUserId, body);
  }
}
