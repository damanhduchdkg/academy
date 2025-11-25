// src/courses/courses.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseLevel, Prisma } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Danh sách khoá học cho user hiện tại (FE trang "Đào tạo").
   * Chỉ hiển thị nếu:
   *  - Khoá đã publish
   *  - Role user nằm trong allowed_roles
   *  - User đã được gán khoá (UserCourseAssignment)
   */
  async searchCoursesForUser(params: {
    userId: string;
    role: string; // 'user' | 'manager' | 'admin'
    search?: string;
    page: number;
    pageSize: number;
  }) {
    const { userId, role, search, page, pageSize } = params;

    const baseWhere: Prisma.CourseWhereInput = {
      is_published: true,
      allowed_roles: {
        has: role,
      },
      // 🔹 BẮT BUỘC: user phải được gán khoá
      userAssignments: {
        some: {
          user_id: userId,
        },
      },
    };

    const where: Prisma.CourseWhereInput = search
      ? {
          ...baseWhere,
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } },
          ],
        }
      : baseWhere;

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
          lessons: { select: { id: true } },
          userProgresses: {
            where: { user_id: userId },
            select: {
              completion_percent: true,
              is_completed: true,
            },
            take: 1,
          },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    const data = items.map((c) => {
      const rawProgress = c.userProgresses[0] ?? {
        completion_percent: 0,
        is_completed: false,
      };

      const pctNum = Number(rawProgress.completion_percent) || 0;
      const normalizedPercent = (() => {
        if (pctNum < 0) return 0;
        if (pctNum > 100) return 100;
        return Math.round(pctNum);
      })();
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
   * User phải:
   *  - Có role phù hợp allowed_roles
   *  - ĐÃ được gán khoá (UserCourseAssignment)
   */
  async getCourseDetailForUser(courseId: string, userId: string, role: string) {
    const course = await this.prisma.course.findFirst({
      where: {
        id: courseId,
        is_published: true,
        allowed_roles: { has: role },
        // 🔹 BẮT BUỘC: user phải được gán khoá
        userAssignments: {
          some: { user_id: userId },
        },
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
            type: true,
            duration_seconds: true,
            is_mandatory: true,
            order_index: true,
            progresses: {
              where: { user_id: userId },
              select: { completed: true, watched_seconds: true },
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

    // Không tìm thấy = hoặc khoá không tồn tại, hoặc user không được gán
    if (!course) {
      return null;
    }

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
     * Build danh sách bài học:
     * - PDF/SLIDE: duration_seconds = số trang ⇒ duration_minutes = số_trang
     * - VIDEO/TEXT: duration_minutes = số phút (>=1)
     * - user_progress: { completed, unlocked }
     */
    const baseLessons = course.lessons.map((l) => {
      const lp = l.progresses[0];

      // ép duration_seconds về number an toàn
      const rawSec = Number(l.duration_seconds);
      let duration_minutes: number | null = null;

      if (Number.isFinite(rawSec) && rawSec > 0) {
        if (l.type === 'pdf' || l.type === 'slide') {
          // PDF/SLIDE: duration_seconds là SỐ TRANG
          duration_minutes = Math.max(1, Math.floor(rawSec));
        } else {
          // VIDEO/TEXT: đổi sang phút
          duration_minutes = Math.max(1, Math.round(rawSec / 60));
        }
      }

      const completed = !!lp?.completed;

      return {
        id: l.id,
        order: l.order_index,
        title: l.title,
        type: l.type,
        duration_minutes,
        is_required: l.is_mandatory,
        completed,
      };
    });

    // Áp dụng rule mở khoá: bài 1 luôn mở; các bài sau chỉ mở khi bài trước completed
    const lessons = baseLessons.map((lesson, idx) => {
      const unlocked = idx === 0 ? true : !!baseLessons[idx - 1]?.completed;

      return {
        id: lesson.id,
        order: lesson.order,
        title: lesson.title,
        type: lesson.type,
        duration_minutes: lesson.duration_minutes,
        is_required: lesson.is_required,
        user_progress: {
          completed: lesson.completed,
          unlocked,
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
   * Admin tạo khoá học mới
   */
  async createCourseForAdmin(adminUserId: string, body: CreateCourseDto) {
    const created = await this.prisma.course.create({
      data: {
        title: body.title,
        description: body.description ?? '',
        category: body.category ?? '',
        level: (body.level as CourseLevel) ?? CourseLevel.Basic,
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
   * Admin xem danh sách khoá học (màn Admin → Quản lý khoá học)
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
      level: c.level,
      is_required: c.is_required,
      is_published: c.is_published,
      allowed_roles: c.allowed_roles,
      lessons_count: c.lessons.length,
    }));

    return { page, pageSize, total, data };
  }

  /**
   * Gán khoá học cho user (bảng UserCourseAssignment)
   * Chỉ cho phép nếu role của user nằm trong allowed_roles của khoá.
   */
  async assignUserToCourse(courseId: string, userId: string) {
    if (!courseId) {
      throw new BadRequestException('courseId is required');
    }
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const [course, user] = await this.prisma.$transaction([
      this.prisma.course.findUnique({
        where: { id: courseId },
        select: {
          id: true,
          title: true,
          allowed_roles: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          full_name: true,
          role: true,
        },
      }),
    ]);

    if (!course) {
      throw new NotFoundException('Course không tồn tại');
    }
    if (!user) {
      throw new NotFoundException('User không tồn tại');
    }

    // 🔹 Nếu khoá có cấu hình allowed_roles và role user không nằm trong đó -> chặn
    const allowedRoles = course.allowed_roles || [];
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      if (!allowedRoles.includes(user.role)) {
        throw new ForbiddenException(
          `Role "${user.role}" không nằm trong allowed_roles của khoá này`,
        );
      }
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
      course,
      user,
      assignment,
    };
  }

  /**
   * Bỏ gán khoá học khỏi user
   */
  async unassignUserFromCourse(courseId: string, userId: string) {
    if (!courseId) {
      throw new BadRequestException('courseId is required');
    }
    if (!userId) {
      throw new BadRequestException('userId is required');
    }

    const result = await this.prisma.userCourseAssignment.deleteMany({
      where: {
        user_id: userId,
        course_id: courseId,
      },
    });

    return {
      success: true,
      deleted: result.count,
      message:
        result.count > 0
          ? 'Gỡ gán khoá học thành công'
          : 'Không tìm thấy gán khoá học nào để gỡ',
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
        level: (body.level as CourseLevel) ?? existing.level,
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
