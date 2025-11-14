import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class LessonProgressRepo {
  constructor(private prisma: PrismaService) {}

  get(userId: string, lessonId: string) {
    return this.prisma.userLessonProgress.findUnique({
      where: { user_id_lesson_id: { user_id: userId, lesson_id: lessonId } },
    });
  }

  upsertBase(userId: string, lessonId: string) {
    return this.prisma.userLessonProgress.upsert({
      where: { user_id_lesson_id: { user_id: userId, lesson_id: lessonId } },
      create: {
        user_id: userId,
        lesson_id: lessonId,
      } as Prisma.UserLessonProgressUncheckedCreateInput,
      update: {} as Prisma.UserLessonProgressUncheckedUpdateInput,
    });
  }

  markViolated(userId: string, lessonId: string) {
    return this.prisma.userLessonProgress.update({
      where: { user_id_lesson_id: { user_id: userId, lesson_id: lessonId } },
      data: { violated_at: new Date() },
    });
  }

  resetOnViolate(userId: string, lessonId: string) {
    return this.prisma.userLessonProgress.update({
      where: { user_id_lesson_id: { user_id: userId, lesson_id: lessonId } },
      data: {
        watched_seconds: 0,
        last_position_sec: 0,
        coverage_json: [],
        violated_at: null,
        completed: false,
        completed_at: null,
        last_hb_at: null,
      },
    });
  }

  saveProgress(
    userId: string,
    lessonId: string,
    data: {
      watchedSecs: number;
      lastPosSec: number;
      coverageJson: [number, number][];
      completed?: boolean;
      completedAt?: Date | null;
    },
  ) {
    return this.prisma.userLessonProgress.update({
      where: { user_id_lesson_id: { user_id: userId, lesson_id: lessonId } },
      data: {
        watched_seconds: data.watchedSecs,
        last_position_sec: data.lastPosSec,
        coverage_json: data.coverageJson as any,
        completed: data.completed ?? undefined,
        completed_at: data.completedAt ?? undefined,
        last_seen_at: new Date(),
        last_hb_at: new Date(),
      },
    });
  }
}
