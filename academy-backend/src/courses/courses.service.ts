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
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { Workbook } from 'exceljs';

// ====== HELPER: Chuẩn hoá text, bỏ dấu tiếng Việt, về lowercase ======
function normalizeVN(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

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
      userAssignments: {
        some: {
          user_id: userId,
        },
      },
    };

    const hasSearch = !!(search && search.trim());
    const normalizedQuery = normalizeVN(search || '');

    let itemsRaw: {
      id: string;
      title: string;
      description: string | null;
      category: string | null;
      is_required: boolean;
      lessons: { id: string }[];
      userProgresses: { completion_percent: any; is_completed: boolean }[];
    }[] = [];
    let total = 0;

    if (!hasSearch) {
      // ✅ TRƯỜNG HỢP KHÔNG TÌM KIẾM: giữ nguyên logic cũ (phân trang DB)
      const [items, count] = await this.prisma.$transaction([
        this.prisma.course.findMany({
          where: baseWhere,
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
        this.prisma.course.count({ where: baseWhere }),
      ]);

      itemsRaw = items;
      total = count;
    } else {
      // ✅ TRƯỜNG HỢP CÓ TÌM KIẾM: lấy toàn bộ khoá của user, filter fuzzy ở memory
      const allCourses = await this.prisma.course.findMany({
        where: baseWhere,
        orderBy: { created_at: 'desc' },
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
      });

      const filtered = allCourses.filter((c) => {
        const title = normalizeVN(c.title);
        const desc = normalizeVN(c.description);
        const cat = normalizeVN(c.category);
        return (
          title.includes(normalizedQuery) ||
          desc.includes(normalizedQuery) ||
          cat.includes(normalizedQuery)
        );
      });

      total = filtered.length;

      // Phân trang trên mảng kết quả
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      itemsRaw = filtered.slice(start, end);
    }

    // ===== Giữ nguyên đoạn map progress & return như cũ =====
    const data = itemsRaw.map((c) => {
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
   * Thống kê tổng quan cho Admin dashboard
   * Dùng đơn giản các bảng: user, course, lesson, userCourseAssignment
   */
  async getAdminOverview() {
    const [
      totalUsers,
      activeUsers,
      totalCourses,
      publishedCourses,
      totalLessons,
      totalAssignments,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { status: 'active' }, // enum UserStatus
      }),
      this.prisma.course.count(),
      this.prisma.course.count({ where: { is_published: true } }),
      this.prisma.lesson.count(),
      this.prisma.userCourseAssignment.count(),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalCourses,
      publishedCourses,
      totalLessons,
      totalAssignments,
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

  /**
   * Export báo cáo 1 khoá sang CSV (Excel mở được)
   * - Lấy danh sách user được gán khoá
   * - Ghép với tiến độ khoá và lần hoạt động gần nhất
   * - Lọc theo from / to nếu có (dựa trên completed_at hoặc last_seen_at hoặc ngày gán khoá)
   */
  async exportCourseReportAsCsv(params: {
    courseId: string;
    from?: string;
    to?: string;
  }): Promise<{ filename: string; csv: string }> {
    const { courseId, from, to } = params;

    // --------- Parse ngày nếu có ----------
    const parseDate = (value?: string): Date | undefined => {
      if (!value) return undefined;
      const d = new Date(value);
      return isNaN(d.getTime()) ? undefined : d;
    };

    const fromDate = parseDate(from);
    const toDateRaw = parseDate(to);
    // Cho "to" inclusive: cộng thêm 1 ngày
    const toDate = toDateRaw
      ? new Date(toDateRaw.getTime() + 24 * 60 * 60 * 1000)
      : undefined;

    // --------- Lấy thông tin khoá + gán khoá ----------
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Course không tồn tại');
    }

    const assignments = await this.prisma.userCourseAssignment.findMany({
      where: { course_id: courseId },
      select: {
        user_id: true,
        created_at: true,
        user: {
          select: {
            id: true,
            full_name: true,
            username: true,
            role: true,
            status: true,
          },
        },
      },
    });

    const userIds = assignments.map((a) => a.user_id);
    if (userIds.length === 0) {
      const header = [
        'UserId',
        'Họ tên',
        'Username',
        'Vai trò',
        'Trạng thái',
        '% hoàn thành',
        'Ngày hoàn thành',
        'Hoạt động gần nhất',
      ];
      const csv = '\uFEFF' + header.join(',') + '\r\n';
      const filename = `report_${this.slugify(course.title)}.csv`;
      return { filename, csv };
    }

    // Lấy tiến độ khoá & tiến độ bài học
    const [courseProgresses, lessonProgresses] = await this.prisma.$transaction(
      [
        this.prisma.userCourseProgress.findMany({
          where: {
            course_id: courseId,
            user_id: { in: userIds },
          },
        }),
        this.prisma.userLessonProgress.findMany({
          where: {
            user_id: { in: userIds },
            lesson: { course_id: courseId },
          },
        }),
      ],
    );

    const progressByUser = new Map<string, (typeof courseProgresses)[number]>();
    for (const cp of courseProgresses) {
      progressByUser.set(cp.user_id, cp);
    }

    const lastSeenByUser = new Map<string, Date>();
    for (const lp of lessonProgresses) {
      const current = lastSeenByUser.get(lp.user_id);
      if (!current || lp.last_seen_at > current) {
        lastSeenByUser.set(lp.user_id, lp.last_seen_at);
      }
    }

    const now = new Date();
    const ONE_MINUTE = 60 * 1000;
    const oneMinuteAgo = new Date(now.getTime() - ONE_MINUTE);

    type Row = {
      userId: string;
      fullName: string;
      username: string;
      role: string;
      status: string;
      percent: number;
      completedAt?: Date | null;
      lastSeen?: Date | null;
    };

    const rows: Row[] = [];

    for (const a of assignments) {
      const cp = progressByUser.get(a.user_id);
      const lastSeen = lastSeenByUser.get(a.user_id) ?? null;

      const pctRaw = cp ? Number(cp.completion_percent) : 0;
      const pct = pctRaw < 0 ? 0 : pctRaw > 100 ? 100 : Math.round(pctRaw || 0);
      const completed = !!cp?.is_completed;
      const completedAt = cp?.completed_at ?? null;

      let status: 'not_started' | 'learning' | 'completed';
      if (completed) status = 'completed';
      else if (pct > 0 || lastSeen) status = 'learning';
      else status = 'not_started';

      const isOnline = lastSeen && lastSeen >= oneMinuteAgo;

      // Ngày "activity" dùng để filter: ưu tiên completedAt, sau đó lastSeen, cuối cùng là ngày gán khoá
      const activityDate = completedAt || lastSeen || a.created_at;

      if (fromDate && activityDate < fromDate) {
        continue;
      }
      if (toDate && activityDate >= toDate) {
        continue;
      }

      rows.push({
        userId: a.user_id,
        fullName: a.user?.full_name || '',
        username: a.user?.username || '',
        role: a.user?.role || '',
        status:
          status === 'completed'
            ? 'Đã hoàn thành'
            : status === 'learning'
              ? isOnline
                ? 'Đang học (Online)'
                : 'Đang học'
              : 'Chưa bắt đầu',
        percent: pct,
        completedAt,
        lastSeen,
      });
    }

    // --------- Build CSV ----------
    const header = [
      'UserId',
      'Họ tên',
      'Username',
      'Vai trò',
      'Trạng thái',
      '% hoàn thành',
      'Ngày hoàn thành (ISO)',
      'Hoạt động gần nhất (ISO)',
    ];

    const lines: string[] = [];
    lines.push(header.map(this.csvEscape).join(','));

    for (const r of rows) {
      const line = [
        r.userId,
        r.fullName,
        r.username,
        r.role,
        r.status,
        String(r.percent),
        r.completedAt ? r.completedAt.toISOString() : '',
        r.lastSeen ? r.lastSeen.toISOString() : '',
      ]
        .map(this.csvEscape)
        .join(',');

      lines.push(line);
    }

    const csv = '\uFEFF' + lines.join('\r\n');
    const filename = `report_${this.slugify(course.title)}.csv`;

    return { filename, csv };
  }

  // ====== Helpers cho CSV ======
  private csvEscape(value: string): string {
    if (value == null) return '';
    let s = String(value);
    if (s.includes('"')) {
      s = s.replace(/"/g, '""');
    }
    if (s.includes(',') || s.includes('\n') || s.includes('"')) {
      return `"${s}"`;
    }
    return s;
  }

  private slugify(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  /**
   * Export báo cáo khoá học dạng Excel (.xlsx)
   * File: Bao_cao_khoa_hoc.xlsx
   * Cột: Username, Họ và tên, Vai trò, Khoá học, % Hoàn thành, Trạng thái, Ngày hoàn thành
   */
  async exportCourseExcelReport(
    courseId: string,
    res: Response,
  ): Promise<void> {
    // 1. Lấy thông tin khoá
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
      },
    });

    if (!course) {
      res.status(404).json({ message: 'Course không tồn tại' });
      return;
    }

    // 2. Lấy danh sách user được gán + tiến độ khoá
    const assignments = await this.prisma.userCourseAssignment.findMany({
      where: { course_id: courseId },
      select: {
        user_id: true,
        user: {
          select: {
            username: true,
            full_name: true,
            role: true,
          },
        },
      },
    });

    const progresses = await this.prisma.userCourseProgress.findMany({
      where: { course_id: courseId },
      select: {
        user_id: true,
        completion_percent: true,
        is_completed: true,
        completed_at: true,
      },
    });

    const progressMap = new Map<
      string,
      {
        completion_percent: number;
        is_completed: boolean;
        completed_at: Date | null;
      }
    >();

    for (const p of progresses) {
      const pct = Number(p.completion_percent) || 0;
      const safePct = pct < 0 ? 0 : pct > 100 ? 100 : Math.round(pct);

      progressMap.set(p.user_id, {
        completion_percent: safePct,
        is_completed: p.is_completed || safePct >= 100,
        completed_at: p.completed_at ?? null,
      });
    }

    // 3. Chuẩn bị workbook Excel
    const wb = new Workbook();
    const ws = wb.addWorksheet('Báo cáo');

    // Cấu hình cột (thứ tự + width)
    ws.columns = [
      { header: 'Username', key: 'username', width: 20 },
      { header: 'Họ và tên', key: 'full_name', width: 28 },
      { header: 'Vai trò', key: 'role', width: 14 },
      { header: 'Khoá học', key: 'course', width: 30 },
      { header: '% Hoàn thành', key: 'percent', width: 16 },
      { header: 'Trạng thái', key: 'status', width: 18 },
      { header: 'Ngày hoàn thành', key: 'completed', width: 24 },
    ];

    // 4. Tiêu đề bảng (row 1) – merge A1:G1
    ws.mergeCells('A1:G1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `BÁO CÁO KHOÁ HỌC - ${course.title}`;
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Để 1 dòng trống (row 2), header bắt đầu từ row 3
    const headerRowIndex = 3;
    const headerRow = ws.getRow(headerRowIndex);
    headerRow.values = [
      'Username',
      'Họ và tên',
      'Vai trò',
      'Khoá học',
      '% Hoàn thành',
      'Trạng thái',
      'Ngày hoàn thành',
    ];
    headerRow.font = { size: 14, bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // 5. Ghi dữ liệu từng user (từ row 4)
    let rowIndex = headerRowIndex + 1;

    for (const a of assignments) {
      const u = a.user;
      const prog = progressMap.get(a.user_id);

      const pct = prog?.completion_percent ?? 0;
      let statusText = 'Chưa bắt đầu';
      if (prog) {
        if (prog.is_completed || pct >= 100) statusText = 'Đã hoàn thành';
        else if (pct > 0) statusText = 'Đang học';
      }

      const completedDate = prog?.completed_at
        ? prog.completed_at.toISOString()
        : '';

      const row = ws.getRow(rowIndex++);
      row.values = [
        u?.username || '',
        u?.full_name || '',
        u?.role || '',
        course.title,
        pct,
        statusText,
        completedDate,
      ];
      row.font = { size: 12 }; // nội dung 12px
    }

    // Kẻ border nhẹ cho header + vùng data (cho đẹp, không bắt buộc)
    const lastDataRow = rowIndex - 1;
    for (let r = headerRowIndex; r <= lastDataRow; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= 7; c++) {
        const cell = row.getCell(c);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      }
    }

    // 6. Gửi file về FE
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Báo_Cáo_Khoá_Học.xlsx"',
    );

    await wb.xlsx.write(res as any);
    res.end();
  }
  // Báo cáo tổng tất cả các khoá học
  async exportAllCoursesExcelReport(res: Response) {
    // 1) Lấy toàn bộ assignment (user được gán khoá)
    const assignments = await this.prisma.userCourseAssignment.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            full_name: true,
            role: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: [{ course_id: 'asc' }, { user_id: 'asc' }],
    });

    if (assignments.length === 0) {
      // Không có dữ liệu thì trả file rỗng nhưng vẫn đúng format
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Bao_cao');

      // Tiêu đề
      sheet.mergeCells('A1:G1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = 'BÁO CÁO KHOÁ HỌC';
      titleCell.font = { size: 16, bold: true };
      titleCell.alignment = { horizontal: 'center' };

      // Header
      const headerRow = sheet.addRow([
        'Username',
        'Họ và tên',
        'Vai trò',
        'Khoá học',
        '% Hoàn thành',
        'Trạng thái',
        'Ngày hoàn thành',
      ]);
      headerRow.font = { size: 14, bold: true };

      // Set width cơ bản
      sheet.columns = [
        { key: 'username', width: 22 },
        { key: 'full_name', width: 28 },
        { key: 'role', width: 14 },
        { key: 'course_title', width: 30 },
        { key: 'completion_percent', width: 16 },
        { key: 'status', width: 16 },
        { key: 'completed_at', width: 24 },
      ];

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="Báo Cáo Tất Cả Khoá Học.xlsx"',
      );

      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    // 2) Lấy progress cho tất cả (user, course) tương ứng
    const userIds = Array.from(new Set(assignments.map((a) => a.user_id)));
    const courseIds = Array.from(new Set(assignments.map((a) => a.course_id)));

    const progresses = await this.prisma.userCourseProgress.findMany({
      where: {
        user_id: { in: userIds },
        course_id: { in: courseIds },
      },
    });

    const progressMap = new Map<string, (typeof progresses)[number]>();
    for (const p of progresses) {
      progressMap.set(`${p.user_id}_${p.course_id}`, p);
    }

    // 3) Build dữ liệu report
    const rows = assignments.map((a) => {
      const key = `${a.user_id}_${a.course_id}`;
      const p = progressMap.get(key);

      const percentRaw = p ? Number(p.completion_percent) : 0;
      const completion_percent = Math.max(
        0,
        Math.min(100, Math.round(percentRaw || 0)),
      );

      let status = 'Chưa bắt đầu';
      if (p?.is_completed) {
        status = 'Đã hoàn thành';
      } else if (completion_percent > 0) {
        status = 'Đang học';
      }

      const completed_at = p?.completed_at ? p.completed_at.toISOString() : '';

      return {
        username: a.user.username,
        full_name: a.user.full_name,
        role: a.user.role,
        course_title: a.course.title,
        completion_percent,
        status,
        completed_at,
      };
    });

    // 4) Tạo workbook Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Bao_cao');

    // Tiêu đề bảng: dòng 1
    sheet.mergeCells('A1:G1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'BÁO CÁO KHOÁ HỌC';
    titleCell.font = { size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    // Dòng header (dòng 2)
    const headerRow = sheet.addRow([
      'Username',
      'Họ và tên',
      'Vai trò',
      'Khoá học',
      '% Hoàn thành',
      'Trạng thái',
      'Ngày hoàn thành',
    ]);
    headerRow.font = { size: 14, bold: true };

    // Đặt width từng cột
    sheet.columns = [
      { key: 'username', width: 22 },
      { key: 'full_name', width: 28 },
      { key: 'role', width: 14 },
      { key: 'course_title', width: 30 },
      { key: 'completion_percent', width: 16 },
      { key: 'status', width: 16 },
      { key: 'completed_at', width: 24 },
    ];

    // Thêm từng dòng dữ liệu (từ dòng 3)
    for (const r of rows) {
      const row = sheet.addRow([
        r.username,
        r.full_name,
        r.role,
        r.course_title,
        r.completion_percent,
        r.status,
        r.completed_at,
      ]);
      row.font = { size: 12 }; // Nội dung: 12px
    }

    // Border nhẹ cho đẹp
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 2) {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      }
    });

    // 5) Gửi file về client
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Báo_Cáo_Khoá_Học.xlsx"',
    );

    await workbook.xlsx.write(res);
    res.end();
  }
  // Xuất excel
  // async exportExcelReport(
  //   courseId: string,
  //   from: string,
  //   to: string,
  //   res: Response,
  // ) {
  //   const fromDate = from ? new Date(from) : null;
  //   const toDate = to ? new Date(to) : null;

  //   // 1. Lấy thông tin khoá
  //   const course = await this.prisma.course.findUnique({
  //     where: { id: courseId },
  //     select: {
  //       id: true,
  //       title: true,
  //       category: true,
  //       is_required: true,
  //       is_published: true,
  //       lessons: {
  //         select: { id: true, title: true, type: true },
  //         orderBy: { order_index: 'asc' },
  //       },
  //       userAssignments: {
  //         select: {
  //           user: {
  //             select: {
  //               id: true,
  //               full_name: true,
  //               role: true,
  //             },
  //           },
  //         },
  //       },
  //     },
  //   });

  //   if (!course) throw new NotFoundException('Khoá không tồn tại');

  //   const assignedUserIds = course.userAssignments.map((a) => a.user.id);

  //   // 2. Lấy progress user
  //   const usersProgress = await this.prisma.userCourseProgress.findMany({
  //     where: {
  //       course_id: courseId,
  //       user_id: { in: assignedUserIds },
  //       ...(fromDate && toDate
  //         ? {
  //             OR: [
  //               { completed_at: { gte: fromDate, lte: toDate } },
  //               {
  //                 // user hoạt động trong giai đoạn lọc
  //                 user: {
  //                   activityLogs: {
  //                     some: {
  //                       timestamp: { gte: fromDate, lte: toDate },
  //                     },
  //                   },
  //                 },
  //               },
  //             ],
  //           }
  //         : {}),
  //     },
  //     select: {
  //       user_id: true,
  //       completion_percent: true,
  //       is_completed: true,
  //       completed_at: true,
  //       user: {
  //         select: {
  //           full_name: true,
  //           role: true,
  //           last_login_at: true,
  //         },
  //       },
  //     },
  //   });

  //   // 3. Workbook
  //   const workbook = new ExcelJS.Workbook();
  //   const sheet1 = workbook.addWorksheet('Tổng quan');
  //   const sheet2 = workbook.addWorksheet('Tiến độ user');
  //   const sheet3 = workbook.addWorksheet('Tiến độ bài học');

  //   /* ---------- SHEET 1 ---------- */
  //   sheet1.addRows([
  //     ['Tên khoá', course.title],
  //     ['Danh mục', course.category ?? ''],
  //     ['Tổng user được gán', assignedUserIds.length],
  //     [
  //       'User đã bắt đầu',
  //       usersProgress.filter((u) => Number(u.completion_percent) > 0).length,
  //     ],
  //     [
  //       'User đã hoàn thành',
  //       usersProgress.filter((u) => u.is_completed).length,
  //     ],
  //     ['User hoạt động theo lọc', usersProgress.length],
  //   ]);

  //   /* ---------- SHEET 2 ---------- */
  //   sheet2.addRow([
  //     'Họ tên',
  //     'Vai trò',
  //     '% hoàn thành',
  //     'Trạng thái',
  //     'Hoạt động gần nhất',
  //     'Ngày hoàn thành',
  //   ]);

  //   usersProgress.forEach((u) => {
  //     sheet2.addRow([
  //       u.user.full_name,
  //       u.user.role,
  //       Number(u.completion_percent),
  //       u.is_completed ? 'Hoàn thành' : 'Đang học',
  //       u.user.last_login_at?.toISOString() ?? '',
  //       u.completed_at?.toISOString() ?? '',
  //     ]);
  //   });

  //   /* ---------- SHEET 3 ---------- */
  //   sheet3.addRow(['STT', 'Tên bài', 'Loại', 'Số user hoàn thành', 'Tỷ lệ']);

  //   for (let i = 0; i < course.lessons.length; i++) {
  //     const l = course.lessons[i];

  //     const completedCount = await this.prisma.userLessonProgress.count({
  //       where: { lesson_id: l.id, completed: true },
  //     });

  //     const percent = assignedUserIds.length
  //       ? Math.round((completedCount / assignedUserIds.length) * 100)
  //       : 0;

  //     sheet3.addRow([i + 1, l.title, l.type, completedCount, `${percent}%`]);
  //   }

  //   // ----- DOWNLOAD -----
  //   res.setHeader(
  //     'Content-Disposition',
  //     `attachment; filename=report_${course.title.replace(/\s+/g, '_')}.xlsx`,
  //   );
  //   res.setHeader(
  //     'Content-Type',
  //     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  //   );

  //   await workbook.xlsx.write(res as any);
  //   res.end();
  // }
}
