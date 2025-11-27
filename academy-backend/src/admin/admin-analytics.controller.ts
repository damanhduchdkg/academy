// src/admin/admin-dashboard.controller.ts
import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import { AdminGuard } from './admin.guard';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminDashboardController {
  constructor(private prisma: PrismaService) {}

  // 👉 HÀNG SỐ DÙNG CHUNG: 1 phút gần nhất để tính "đang học"
  private getActiveSince(): Date {
    const ACTIVE_WINDOW_MS = 10 * 1000; // 1 phút
    const now = new Date();
    return new Date(now.getTime() - ACTIVE_WINDOW_MS);
  }

  // =======================
  // 1) Tổng quan toàn hệ thống
  // =======================
  @Get('overview')
  async getOverview() {
    const activeSince = this.getActiveSince();

    const [
      totalUsers,
      totalCourses,
      publishedCourses,
      totalLessons,
      totalAssignments,
      activeLearnerRows,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.course.count(),
      this.prisma.course.count({ where: { is_published: true } }),
      this.prisma.lesson.count(),
      this.prisma.userCourseAssignment.count(),
      this.prisma.userLessonProgress.findMany({
        where: {
          last_seen_at: { gte: activeSince },
        },
        select: {
          user_id: true,
          lesson: { select: { course_id: true } },
        },
      }),
    ]);

    // Gom theo course_id → set user_id
    const activeMap = new Map<string, Set<string>>();
    for (const row of activeLearnerRows) {
      const courseId = row.lesson?.course_id;
      if (!courseId) continue;
      if (!activeMap.has(courseId)) {
        activeMap.set(courseId, new Set());
      }
      activeMap.get(courseId)!.add(row.user_id);
    }

    // Số lượng học viên đang hoạt động (unique theo user_id)
    const activeUsers = (() => {
      if (!activeLearnerRows || activeLearnerRows.length === 0) return 0;
      const s = new Set<string>();
      for (const row of activeLearnerRows) {
        if (row && typeof row.user_id === 'string') {
          s.add(row.user_id);
        }
      }
      return s.size;
    })();

    return {
      totalUsers,
      activeUsers,
      totalCourses,
      publishedCourses,
      totalLessons,
      totalAssignments,
    };
  }

  // =======================
  // 2) Thống kê theo từng khoá học
  // =======================
  @Get('overview/courses')
  async getCourseOverview() {
    const activeSince = this.getActiveSince();

    const courses = await this.prisma.course.findMany({
      orderBy: { created_at: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        is_published: true,
      },
    });

    if (courses.length === 0) {
      return [];
    }

    const courseIds = courses.map((c) => c.id);

    // 1) Số bài học mỗi khoá
    const lessons = await this.prisma.lesson.findMany({
      where: { course_id: { in: courseIds } },
      select: { id: true, course_id: true },
    });
    const lessonCountMap = new Map<string, number>();
    for (const l of lessons) {
      lessonCountMap.set(
        l.course_id,
        (lessonCountMap.get(l.course_id) || 0) + 1,
      );
    }

    // 2) Số lượt gán khoá cho user
    const assignments = await this.prisma.userCourseAssignment.findMany({
      where: { course_id: { in: courseIds } },
      select: { course_id: true },
    });
    const assignCountMap = new Map<string, number>();
    for (const a of assignments) {
      assignCountMap.set(
        a.course_id,
        (assignCountMap.get(a.course_id) || 0) + 1,
      );
    }

    // 3) Số user đã hoàn thành khoá
    const completedRows = await this.prisma.userCourseProgress.findMany({
      where: {
        course_id: { in: courseIds },
        is_completed: true,
      },
      select: { course_id: true },
    });
    const completedCountMap = new Map<string, number>();
    for (const r of completedRows) {
      completedCountMap.set(
        r.course_id,
        (completedCountMap.get(r.course_id) || 0) + 1,
      );
    }

    // 4) User đang học theo từng khoá (cùng mốc thời gian 1 phút)
    const activeRows = await this.prisma.userLessonProgress.findMany({
      where: {
        last_seen_at: { gte: activeSince },
        lesson: {
          course_id: { in: courseIds },
        },
      },
      select: {
        user_id: true,
        lesson: { select: { course_id: true } },
      },
    });

    const activeMap = new Map<string, Set<string>>();
    for (const row of activeRows) {
      const courseId = row.lesson?.course_id;
      if (!courseId) continue;
      if (!activeMap.has(courseId)) {
        activeMap.set(courseId, new Set());
      }
      activeMap.get(courseId)!.add(row.user_id);
    }

    const result = courses.map((c) => {
      const lessonsCount = lessonCountMap.get(c.id) || 0;
      const assignmentsCount = assignCountMap.get(c.id) || 0;
      const completedUsers = completedCountMap.get(c.id) || 0;
      const activeLearners = activeMap.get(c.id)?.size || 0;

      return {
        id: c.id,
        title: c.title,
        is_published: c.is_published,
        lessonsCount,
        assignmentsCount,
        completedUsers,
        activeLearners,
      };
    });

    return result;
  }

  // =======================
  // 3) Hoạt động học gần đây (nhật ký)
  // =======================
  @Get('overview/activity')
  async getRecentActivity() {
    // Lấy 20 bản ghi gần nhất theo last_seen_at
    const rows = await this.prisma.userLessonProgress.findMany({
      orderBy: { last_seen_at: 'desc' },
      take: 20,
      select: {
        last_seen_at: true,
        completed: true,
        completed_at: true,
        lesson: {
          select: {
            id: true,
            title: true,
            course: { select: { id: true, title: true } },
          },
        },
        user: {
          select: {
            id: true,
            full_name: true,
            // email: true,
          },
        },
      },
    });

    return rows.map((r) => ({
      userId: r.user?.id ?? null,
      userName: r.user?.full_name ?? '(Không rõ)',
      // userEmail: r.user?.email ?? null,
      courseId: r.lesson?.course?.id ?? null,
      courseTitle: r.lesson?.course?.title ?? null,
      lessonId: r.lesson?.id ?? null,
      lessonTitle: r.lesson?.title ?? null,
      lastSeenAt: r.last_seen_at,
      completed: r.completed,
      completedAt: r.completed_at,
    }));
  }

  // ======= API mới: /admin/courses/:courseId/analytics =======
  @Get('courses/:courseId/analytics')
  async getCourseAnalytics(@Param('courseId') courseId: string) {
    if (!courseId) {
      throw new BadRequestException('courseId is required');
    }

    // 1) Lấy thông tin khoá + danh sách bài học
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        title: true,
        category: true,
        is_required: true,
        is_published: true,
        lessons: { select: { id: true } },
      },
    });

    if (!course) {
      throw new NotFoundException('Course không tồn tại');
    }

    const lessonIds = course.lessons.map((l) => l.id);

    // 2) Chạy transaction lấy:
    //  - danh sách user được gán khoá
    //  - tiến độ khoá theo user
    //  - last_seen_at theo user trong các bài của khoá
    const [assignments, courseProgressRows, lastSeenRows] =
      await this.prisma.$transaction([
        // user được gán khoá
        this.prisma.userCourseAssignment.findMany({
          where: { course_id: courseId },
          select: {
            user_id: true,
            user: {
              select: {
                full_name: true,
                role: true,
              },
            },
          },
        }),

        // tiến độ khoá
        this.prisma.userCourseProgress.findMany({
          where: { course_id: courseId },
          select: {
            user_id: true,
            completion_percent: true,
            is_completed: true,
            completed_at: true,
          },
        }),

        // last_seen_at theo user trong các bài học thuộc khoá
        this.prisma.userLessonProgress.findMany({
          where: {
            lesson_id: { in: lessonIds },
          },
          select: {
            user_id: true,
            last_seen_at: true,
          },
        }),
      ]);

    const lessonsCount = lessonIds.length;
    const assignedUsers = assignments.length;

    // Map user_id -> progress khoá
    const progressMap = new Map<
      string,
      {
        completion_percent: number;
        is_completed: boolean;
        completed_at: Date | null;
      }
    >();

    for (const row of courseProgressRows) {
      const pctNum = Number(row.completion_percent ?? 0);
      progressMap.set(row.user_id, {
        completion_percent: pctNum,
        is_completed: row.is_completed,
        completed_at: row.completed_at ?? null,
      });
    }

    // Map user_id -> last_seen_at (mới nhất)
    const lastSeenMap = new Map<string, Date | null>();
    for (const row of lastSeenRows) {
      const prev = lastSeenMap.get(row.user_id);
      if (!prev || (row.last_seen_at && row.last_seen_at > prev)) {
        lastSeenMap.set(row.user_id, row.last_seen_at);
      }
    }

    const now = Date.now();
    const ACTIVE_WINDOW_MS = 60 * 1000; // ~1 phút

    let startedUsers = 0;
    let completedUsers = 0;
    let activeUsers = 0;

    const users = assignments.map((a) => {
      const p = progressMap.get(a.user_id);
      const lastSeen = lastSeenMap.get(a.user_id) ?? null;

      const pctRaw = p?.completion_percent ?? 0;
      const completion_percent = Math.max(
        0,
        Math.min(100, Math.round(Number(pctRaw))),
      );

      const isCompleted = !!p?.is_completed || completion_percent >= 100;
      const hasStarted = completion_percent > 0 || !!lastSeen;

      const isOnline =
        !!lastSeen && now - lastSeen.getTime() <= ACTIVE_WINDOW_MS;

      let status: 'not_started' | 'learning' | 'completed';
      if (isCompleted) status = 'completed';
      else if (hasStarted) status = 'learning';
      else status = 'not_started';

      if (hasStarted) startedUsers++;
      if (isCompleted) completedUsers++;
      if (isOnline) activeUsers++;

      return {
        user_id: a.user_id,
        full_name: a.user?.full_name ?? '',
        role: a.user?.role ?? 'user',

        completion_percent,
        is_completed: isCompleted,
        completed_at: p?.completed_at ?? null,

        last_seen_at: lastSeen,
        status,
        is_online: isOnline,
      };
    });

    return {
      course: {
        id: course.id,
        title: course.title,
        category: course.category,
        is_required: course.is_required,
        is_published: course.is_published,
        lessonsCount,
      },
      stats: {
        assignedUsers,
        startedUsers,
        completedUsers,
        activeUsers,
      },
      users,
    };
  }
}
