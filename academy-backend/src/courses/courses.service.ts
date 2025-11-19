import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseLevel } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Danh sách khoá học (có phân trang, search) dành cho user hiện tại.
   *
   * Trả về:
   * {
   *   page,
   *   pageSize,
   *   total,
   *   data: [
   *     {
   *       id,
   *       title,
   *       description,
   *       category,
   *       is_required,
   *       lessons_count,
   *       courseProgress: {
   *         completion_percent: number; // 0..100 đã chuẩn hoá
   *         is_completed: boolean;      // true chỉ khi >=100%
   *       }
   *     },
   *     ...
   *   ]
   * }
   */
  async searchCoursesForUser(params: {
    userId: string;
    role: string; // 'user' | 'manager' | 'admin'
    search?: string;
    page: number;
    pageSize: number;
  }) {
    const { userId, role, search, page, pageSize } = params;

    // Điều kiện khoá học mà user được phép thấy:
    // - is_published = true
    // - allowed_roles CONTAINS vai trò hiện tại
    const baseWhere: any = {
      is_published: true,
      allowed_roles: {
        has: role,
      },
    };

    const where = search
      ? {
          ...baseWhere,
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } },
          ],
        }
      : baseWhere;

    // Lấy danh sách khoá học + progress tổng của user với mỗi khoá
    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          is_required: true,

          lessons: {
            select: { id: true },
          },

          userProgresses: {
            where: { user_id: userId },
            select: {
              completion_percent: true,
              is_completed: true, // giá trị gốc DB (có thể không chuẩn)
            },
            take: 1,
          },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    // Chuẩn hoá dữ liệu trả về cho FE
    const data = items.map((c) => {
      const rawProgress = c.userProgresses[0] ?? {
        completion_percent: 0,
        is_completed: false,
      };

      // ép completion_percent thành số trong khoảng [0..100]
      const pctNum = Number(rawProgress.completion_percent) || 0;
      const normalizedPercent = (() => {
        if (pctNum < 0) return 0;
        if (pctNum > 100) return 100;
        return Math.round(pctNum);
      })();

      // is_completed chỉ TRUE khi >=100%
      const normalizedDone = normalizedPercent >= 100;

      return {
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        is_required: c.is_required,
        lessons_count: c.lessons.length,
        courseProgress: {
          completion_percent: normalizedPercent,
          is_completed: normalizedDone,
        },
      };
    });

    return {
      page,
      pageSize,
      total,
      data,
    };
  }

  /**
   * Chi tiết 1 khoá học cho user hiện tại.
   * Lọc quyền xem theo:
   *  - is_published = true
   *  - allowed_roles has <role>
   */
  async getCourseDetailForUser(courseId: string, userId: string, role: string) {
    // chỉ lấy khoá học mà user có quyền xem
    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        is_published: true,
        allowed_roles: { has: role },
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        is_required: true,

        lessons: {
          orderBy: { order_index: 'asc' },
          select: {
            id: true,
            title: true,
            type: true, // 'video' | 'pdf' | 'slide' | 'text' ...
            duration_seconds: true,
            is_mandatory: true,
            order_index: true,
            progresses: {
              where: { user_id: userId },
              select: {
                completed: true,
                watched_seconds: true,
              },
              take: 1,
            },
          },
        },

        userProgresses: {
          where: { user_id: userId },
          select: {
            completion_percent: true,
            is_completed: true,
          },
          take: 1,
        },
      },
    });

    if (!course) {
      // user không xem được (không có quyền hoặc khoá không tồn tại)
      return null;
    }

    /**
     * ----- Chuẩn hoá tiến độ tổng khoá -----
     */
    const rawCourseProgress = course.userProgresses[0] ?? {
      completion_percent: 0,
      is_completed: false,
    };

    const pctNum = Number(rawCourseProgress.completion_percent) || 0;
    const safePct = (() => {
      if (pctNum < 0) return 0;
      if (pctNum > 100) return 100;
      return Math.round(pctNum);
    })();

    const finished = safePct >= 100;

    const courseProgress = {
      completion_percent: safePct,
      is_completed: finished,
    };

    /**
     * ----- Chuẩn hoá danh sách bài học -----
     */
    const rawLessons = course.lessons.map((l) => {
      const lp = l.progresses[0]; // progress của user cho bài này (nếu có)

      return {
        id: l.id,
        order: l.order_index,
        title: l.title,
        type: l.type, // ví dụ: 'video'
        duration_minutes:
          typeof l.duration_seconds === 'number'
            ? Math.ceil(l.duration_seconds / 60)
            : null,
        is_required: l.is_mandatory,
        completed: lp ? !!lp.completed : false,
      };
    });

    const lessons = rawLessons.map((lesson, idx) => {
      if (idx === 0) {
        // Bài đầu tiên luôn mở
        return {
          ...lesson,
          user_progress: {
            completed: lesson.completed,
            unlocked: true,
          },
        };
      }

      // Các bài sau: mở nếu bài trước đã completed
      const prevLesson = rawLessons[idx - 1];
      const prevDone = !!prevLesson.completed;

      return {
        ...lesson,
        user_progress: {
          completed: lesson.completed,
          unlocked: prevDone,
        },
      };
    });

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      category: course.category,
      is_required: course.is_required,
      lessons,
      courseProgress,
    };
  }

  /**
   * Admin tạo khoá học mới.
   * Dùng cho cả endpoint cũ (/courses/admin/courses) và mới (/admin/courses).
   * Cho phép thiếu level / allowed_roles, sẽ gán default.
   */
  async createCourseForAdmin(adminUserId: string, body: CreateCourseDto) {
    const created = await this.prisma.course.create({
      data: {
        title: body.title,
        description: body.description ?? '',
        category: body.category ?? '',
        level: body.level, // enum CourseLevel
        is_required: body.is_required ?? false,
        is_published: body.is_published ?? false,
        allowed_roles: body.allowed_roles ?? ['user'],
        created_by: adminUserId,
      },
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        level: true,
        is_required: true,
        is_published: true,
        allowed_roles: true,
        lessons: { select: { id: true } },
      },
    });

    return {
      id: created.id,
      title: created.title,
      description: created.description,
      category: created.category,
      level: created.level,
      is_required: created.is_required,
      is_published: created.is_published,
      allowed_roles: created.allowed_roles,
      lessons_count: created.lessons.length,
    };
  }

  /**
   * Admin xem danh sách khoá học (cho màn Admin → Quản lý khoá học)
   */

  async adminList(params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          description: true,
          category: true,
          level: true,
          is_required: true,
          is_published: true,
          allowed_roles: true,
          lessons: { select: { id: true } },
        },
      }),
      this.prisma.course.count(),
    ]);

    const data = items.map((c) => ({
      id: c.id,
      title: c.title,
      description: c.description,
      category: c.category,
      level: c.level, // <<– trả ra level
      is_required: c.is_required,
      is_published: c.is_published,
      allowed_roles: c.allowed_roles, // <<– trả ra allowed_roles
      lessons_count: c.lessons.length,
    }));

    return { page, pageSize, total, data };
  }

  /**
   * Gán khoá học cho user (bảng UserCourseAssignment)
   */
  async assignUserToCourse(courseId: string, userId: string) {
    if (!courseId) {
      throw new BadRequestException('courseId is required');
    }
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true },
    });
    if (!course) {
      throw new NotFoundException('Course không tồn tại');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('User không tồn tại');
    }

    const assignment = await this.prisma.userCourseAssignment.upsert({
      where: {
        user_id_course_id: {
          user_id: userId,
          course_id: courseId,
        },
      },
      update: {},
      create: {
        user_id: userId,
        course_id: courseId,
      },
    });

    return {
      message: 'Gán khoá học cho user thành công',
      assignment,
    };
  }

  /**
   * Bỏ gán khoá học khỏi user
   */
  async unassignUserFromCourse(courseId: string, userId: string) {
    await this.prisma.userCourseAssignment.deleteMany({
      where: {
        user_id: userId,
        course_id: courseId,
      },
    });

    return {
      success: true,
      message: 'Gỡ gán khoá học thành công',
    };
  }

  /**
   * Admin cập nhật thông tin khoá học
   */
  async updateCourseForAdmin(courseId: string, body: Partial<UpdateCourseDto>) {
    const existing = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!existing) {
      throw new NotFoundException('Course không tồn tại');
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        title: body.title ?? existing.title,
        description: body.description ?? existing.description,
        category: body.category ?? existing.category,
        level: body.level ?? existing.level,
        is_required:
          typeof body.is_required === 'boolean'
            ? body.is_required
            : existing.is_required,
        is_published:
          typeof body.is_published === 'boolean'
            ? body.is_published
            : existing.is_published,
        allowed_roles:
          body.allowed_roles && body.allowed_roles.length > 0
            ? (body.allowed_roles as any)
            : existing.allowed_roles,
      },
      select: {
        id: true,
        title: true,
        category: true,
        is_required: true,
        is_published: true,
        allowed_roles: true,
      },
    });

    return updated;
  }

  /**
   * Admin xoá khoá học
   */
  async deleteCourseByAdmin(courseId: string) {
    const existing = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });

    if (!existing) {
      throw new NotFoundException('Course không tồn tại');
    }

    // Tuỳ ý: nếu muốn cứng hơn thì check lessons count trước khi xoá

    await this.prisma.course.delete({
      where: { id: courseId },
    });

    return {
      success: true,
      message: `Đã xoá khoá "${existing.title}"`,
    };
  }

  /**
   * Admin bật/tắt publish khoá học (active / inactive)
   */
  async togglePublishStatus(courseId: string) {
    const existing = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        is_published: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Course không tồn tại');
    }

    const updated = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        is_published: !existing.is_published,
      },
      select: {
        id: true,
        title: true,
        is_published: true,
      },
    });

    return {
      ...updated,
      status: updated.is_published ? 'active' : 'inactive',
    };
  }
}
