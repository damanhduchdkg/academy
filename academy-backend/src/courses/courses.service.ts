import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';

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
   *
   * Trả về:
   * {
   *   id,
   *   title,
   *   description,
   *   category,
   *   is_required,
   *   lessons: [
   *     {
   *       id,
   *       order,
   *       title,
   *       type,
   *       duration_minutes,
   *       is_required,
   *       user_progress: {
   *         completed: boolean,
   *         unlocked: boolean
   *       }
   *     }, ...
   *   ],
   *   courseProgress: {
   *     completion_percent: number, // 0..100 đã chuẩn hoá
   *     is_completed: boolean       // true chỉ khi >=100%
   *   }
   * }
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
     * B1: map từng bài thành rawLessons (chưa có unlocked)
     * B2: duyệt rawLessons để gắn unlocked theo thứ tự
     *     - Bài đầu tiên luôn unlocked = true
     *     - Bài i>1 unlocked = true nếu bài (i-1) completed
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

    /**
     * ----- Response cuối -----
     */
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
   * (Giữ nguyên logic create như trước)
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
        is_required: true,
        is_published: true,
        allowed_roles: true,
        created_at: true,
      },
    });

    return created;
  }
}
