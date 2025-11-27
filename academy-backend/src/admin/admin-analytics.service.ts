// src/admin/admin-analytics.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAnalyticsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Thống kê tổng quan hệ thống
   */
  async getGlobalStats() {
    const [totalUsers, totalCourses, assignments, completedProgress] =
      await this.prisma.$transaction([
        this.prisma.user.count(),
        this.prisma.course.count(),
        this.prisma.userCourseAssignment.findMany({
          select: { user_id: true },
        }),
        this.prisma.userCourseProgress.findMany({
          where: { is_completed: true },
          select: { user_id: true },
        }),
      ]);

    const assignedUserSet = new Set(assignments.map((a) => a.user_id));
    const assignedUsers = assignedUserSet.size;

    const completedUserSet = new Set(completedProgress.map((p) => p.user_id));
    const usersCompletedAnyCourse = completedUserSet.size;

    return {
      totalUsers,
      totalCourses,
      assignedUsers,
      usersCompletedAnyCourse,
    };
  }

  /**
   * Thống kê theo từng khoá học
   */
  async getCourseStats() {
    const courses = await this.prisma.course.findMany({
      select: {
        id: true,
        title: true,
        userAssignments: {
          select: { user_id: true },
        },
        userProgresses: {
          select: { user_id: true, is_completed: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const data = courses.map((c) => {
      const assignedUserIds = new Set(c.userAssignments.map((a) => a.user_id));
      const totalAssigned = assignedUserIds.size;

      const completedUserIds = new Set(
        c.userProgresses.filter((p) => p.is_completed).map((p) => p.user_id),
      );
      const completedUsers = completedUserIds.size;

      const completionPercent =
        totalAssigned > 0
          ? Math.round((completedUsers / totalAssigned) * 100)
          : 0;

      return {
        course_id: c.id,
        title: c.title,
        totalAssigned,
        completedUsers,
        completionPercent,
      };
    });

    return data;
  }
}
