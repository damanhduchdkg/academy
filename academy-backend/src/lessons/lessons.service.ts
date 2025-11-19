import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LessonType, Prisma } from '@prisma/client';

const LESSON_COMPLETE_THRESHOLD = 0.98; // >=98%
const FINISH_EPSILON_SECONDS = 1.0; // nới 1s ở cuối video

@Injectable()
export class LessonsService {
  constructor(private prisma: PrismaService) {}

  /** GET /lessons/:lessonId */
  async getLessonForUser(args: {
    userId: string;
    userRole: string;
    lessonId: string;
  }) {
    const { userId, userRole, lessonId } = args;

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: { select: { id: true, allowed_roles: true } },
        progresses: { where: { user_id: userId }, take: 1 },
      },
    });

    if (!lesson) throw new NotFoundException('Lesson not found');

    // Nếu là PDF mà chưa có pdf_url -> tự build từ file_id
    if (lesson.type === 'pdf' && !lesson.pdf_url && lesson.pdf_file_id) {
      const base = process.env.BACKEND_PUBLIC_ORIGIN || 'http://localhost:3000';
      lesson.pdf_url = `${base}/files/${lesson.pdf_file_id}`;
    }

    const allowed = lesson.course.allowed_roles || [];
    if (!allowed.includes(userRole) && userRole !== 'admin') {
      throw new ForbiddenException('Not allowed to access this lesson');
    }

    const lp = lesson.progresses[0];

    return {
      lessonMeta: this.buildLessonMeta(lesson),
      lessonProgress: {
        watched_seconds: lp?.watched_seconds ?? 0,
        completed: lp?.completed ?? false,
        completed_at: lp?.completed_at ?? null,
        last_position_sec: lp?.last_position_sec ?? 0,
        violated_at: lp?.violated_at ?? null,
        violation_reason: lp?.violation_reason ?? null,
        // 👇 thêm 2 field cho PDF
        pdfCompletedPages: (lp as any)?.pdfCompletedPages ?? 0,
        pdfTotalPages: (lp as any)?.pdfTotalPages ?? 0,
        pdfCurrentPage: lp?.pdfCurrentPage ?? 1,
      },
    };
  }

  /** PATCH /lessons/:lessonId/progress */
  async updateLessonProgress(args: {
    userId: string;
    userRole: string;
    lessonId: string;
    watchedSeconds: number;
    lastPositionSec: number;
    pdfCurrentPage?: number;
    pdfCompletedPages?: number;
    pdfTotalPages?: number;
    markViolated?: boolean;
    violationReason?: 'seek' | 'rate' | 'both';
    coverage?: Record<string, any>;
  }) {
    const {
      userId,
      userRole,
      lessonId,
      watchedSeconds,
      lastPositionSec,
      pdfCurrentPage,
      pdfCompletedPages,
      pdfTotalPages,
      markViolated,
      violationReason,
      coverage,
    } = args;

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: {
          include: {
            lessons: {
              select: {
                id: true,
                duration_seconds: true,
                is_mandatory: true,
                order_index: true,
              },
            },
          },
        },
        progresses: { where: { user_id: userId }, take: 1 },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const allowed = lesson.course.allowed_roles || [];
    if (!allowed.includes(userRole) && userRole !== 'admin') {
      throw new ForbiddenException('Not allowed to access this lesson');
    }

    const prev = lesson.progresses[0] as any;

    /**
     * =========================
     * 0) NON-VIDEO (PDF/SLIDE/TEXT)
     * =========================
     */
    if (lesson.type !== 'video') {
      const prevCompleted = prev?.pdfCompletedPages ?? 0;
      const prevTotal = prev?.pdfTotalPages ?? 0;
      const prevCurrent = prev?.pdfCurrentPage ?? 1;

      // trang hiện tại FE đang đứng
      const reqCurrent =
        typeof pdfCurrentPage === 'number' && pdfCurrentPage > 0
          ? Math.floor(pdfCurrentPage)
          : undefined;

      // FE có thể gửi thêm số trang đã hoàn thành
      const reqCompleted =
        typeof pdfCompletedPages === 'number'
          ? Math.max(0, Math.floor(pdfCompletedPages))
          : undefined;

      // tổng số trang
      const reqTotal =
        typeof pdfTotalPages === 'number'
          ? Math.max(0, Math.floor(pdfTotalPages))
          : undefined;

      // => không bao giờ cho tụt
      const nextTotal = Math.max(prevTotal, reqTotal ?? 0);

      // completedPages không bao giờ < trang hiện tại và < giá trị cũ
      const baseCompleted = Math.max(prevCompleted, reqCompleted ?? 0);
      const nextCompleted =
        reqCurrent !== undefined
          ? Math.max(baseCompleted, reqCurrent)
          : baseCompleted;

      // currentPage cũng không được nhỏ hơn cái cũ
      const nextCurrent =
        reqCurrent !== undefined
          ? Math.max(prevCurrent, reqCurrent)
          : prevCurrent;

      const updated = await this.prisma.userLessonProgress.upsert({
        where: { user_id_lesson_id: { user_id: userId, lesson_id: lessonId } },
        create: {
          user_id: userId,
          lesson_id: lessonId,
          watched_seconds: 0,
          completed: prev?.completed ?? false,
          completed_at: prev?.completed_at ?? null,
          last_seen_at: new Date(),
          last_position_sec: 0,
          pdfCompletedPages: nextCompleted,
          pdfTotalPages: nextTotal,
          pdfCurrentPage: nextCurrent,
        },
        update: {
          last_seen_at: new Date(),
          pdfCompletedPages: nextCompleted,
          pdfTotalPages: nextTotal,
          pdfCurrentPage: nextCurrent,
        },
      });

      const { courseProgress } = await this.recalcCourseProgress({
        userId,
        courseId: lesson.course_id,
      });

      return {
        lessonMeta: this.buildLessonMeta(lesson),
        lessonProgress: {
          watched_seconds: updated.watched_seconds,
          completed: updated.completed,
          completed_at: updated.completed_at,
          last_position_sec: updated.last_position_sec,
          violated_at: updated.violated_at ?? null,
          violation_reason: updated.violation_reason ?? null,
          pdfCompletedPages: updated.pdfCompletedPages,
          pdfTotalPages: updated.pdfTotalPages,
          pdfCurrentPage: updated.pdfCurrentPage,
        },
        courseProgress,
      };
    }

    /**
     * =========================
     * 1) VIDEO – GIỮ NGUYÊN NHƯ CŨ
     * =========================
     */

    if (prev?.completed) {
      const { courseProgress } = await this.recalcCourseProgress({
        userId,
        courseId: lesson.course_id,
      });
      return {
        lessonMeta: this.buildLessonMeta(lesson),
        lessonProgress: {
          watched_seconds: prev.watched_seconds,
          completed: prev.completed,
          completed_at: prev.completed_at,
          last_position_sec: prev.last_position_sec,
          violated_at: prev.violated_at ?? null,
          violation_reason: prev.violation_reason ?? null,
          pdfCompletedPages: prev.pdfCompletedPages ?? 0,
          pdfTotalPages: prev.pdfTotalPages ?? 0,
        },
        courseProgress,
      };
    }

    if (prev?.violated_at) {
      const { courseProgress } = await this.recalcCourseProgress({
        userId,
        courseId: lesson.course_id,
      });
      return {
        lessonMeta: this.buildLessonMeta(lesson),
        lessonProgress: {
          watched_seconds: prev.watched_seconds,
          completed: prev.completed,
          completed_at: prev.completed_at,
          last_position_sec: 0,
          violated_at: prev.violated_at,
          violation_reason: prev.violation_reason ?? 'policy',
          pdfCompletedPages: prev.pdfCompletedPages ?? 0,
          pdfTotalPages: prev.pdfTotalPages ?? 0,
        },
        courseProgress,
      };
    }

    const totalDuration = lesson.duration_seconds ?? 0;
    const prevWatched = prev?.watched_seconds ?? 0;

    const effectiveWatched = Math.max(prevWatched, Math.floor(watchedSeconds));
    const ratio = totalDuration > 0 ? effectiveWatched / totalDuration : 0;
    const nowCompleted = ratio >= LESSON_COMPLETE_THRESHOLD;

    const safeLastPos =
      Number.isFinite(lastPositionSec) && lastPositionSec >= 0
        ? Math.floor(lastPositionSec)
        : (prev?.last_position_sec ?? 0);

    const data: Prisma.UserLessonProgressUpdateInput = {
      watched_seconds: effectiveWatched,
      completed: nowCompleted,
      completed_at: nowCompleted
        ? (prev?.completed_at ?? new Date())
        : (prev?.completed_at ?? null),
      last_seen_at: new Date(),
      last_position_sec: safeLastPos,
    };

    if (markViolated) {
      (data as any).violated_at = new Date();
      if (violationReason) (data as any).violation_reason = violationReason;
    }
    if (coverage) {
      (data as any).coverage_json = coverage as any;
    }

    const updatedLessonProgress = await this.prisma.userLessonProgress.upsert({
      where: { user_id_lesson_id: { user_id: userId, lesson_id: lessonId } },
      create: {
        user: { connect: { id: userId } },
        lesson: { connect: { id: lessonId } },
        watched_seconds: data.watched_seconds as number,
        completed: data.completed as boolean,
        completed_at: (data.completed_at ?? null) as Date | null,
        last_seen_at: new Date(),
        last_position_sec: data.last_position_sec as number,
        violated_at: (data as any).violated_at ?? undefined,
        violation_reason: (data as any).violation_reason ?? undefined,
        coverage_json: (data as any).coverage_json ?? undefined,
        pdfCompletedPages: 0,
        pdfTotalPages: 0,
      },
      update: {
        watched_seconds: data.watched_seconds as number,
        completed: data.completed as boolean,
        completed_at: (data.completed_at ?? null) as Date | null,
        last_seen_at: new Date(),
        last_position_sec: data.last_position_sec as number,
        violated_at: (data as any).violated_at ?? undefined,
        violation_reason: (data as any).violation_reason ?? undefined,
        coverage_json: (data as any).coverage_json ?? undefined,
      },
    });

    const { courseProgress } = await this.recalcCourseProgress({
      userId,
      courseId: lesson.course_id,
    });

    return {
      lessonMeta: this.buildLessonMeta(lesson),
      lessonProgress: {
        watched_seconds: updatedLessonProgress.watched_seconds,
        completed: updatedLessonProgress.completed,
        completed_at: updatedLessonProgress.completed_at,
        last_position_sec: updatedLessonProgress.last_position_sec,
        violated_at: updatedLessonProgress.violated_at ?? null,
        violation_reason: updatedLessonProgress.violation_reason ?? null,
        pdfCompletedPages:
          (updatedLessonProgress as any).pdfCompletedPages ?? 0,
        pdfTotalPages: (updatedLessonProgress as any).pdfTotalPages ?? 0,
      },
      courseProgress,
    };
  }
  /** PATCH /lessons/:lessonId/finalize */
  async finalizeLesson(args: {
    userId: string;
    userRole: string;
    lessonId: string;
    lastPositionSec?: number;
  }) {
    const { userId, userRole, lessonId, lastPositionSec = 0 } = args;

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: {
          select: {
            id: true,
            allowed_roles: true,
            lessons: {
              select: {
                id: true,
                duration_seconds: true,
                is_mandatory: true,
              },
            },
          },
        },
        progresses: { where: { user_id: userId }, take: 1 },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const allowed = lesson.course.allowed_roles || [];
    if (!allowed.includes(userRole) && userRole !== 'admin') {
      throw new ForbiddenException('Not allowed to access this lesson');
    }

    const prev = lesson.progresses[0] as any;

    // Non-video: coi như “đã đọc xong” => completed ngay
    if (lesson.type !== 'video') {
      const totalPages = (prev as any)?.pdfTotalPages ?? 0;
      const prevCompleted = (prev as any)?.pdfCompletedPages ?? 0;
      const prevCurrent = (prev as any)?.pdfCurrentPage ?? 1;

      const finalCompletedPages =
        totalPages && totalPages > 0 ? totalPages : prevCompleted;

      const finalCurrentPage =
        prevCurrent && prevCurrent > 0
          ? prevCurrent
          : totalPages && totalPages > 0
            ? totalPages
            : 1;

      const updated = await this.prisma.userLessonProgress.upsert({
        where: { user_id_lesson_id: { user_id: userId, lesson_id: lessonId } },
        create: {
          user_id: userId,
          lesson_id: lessonId,
          watched_seconds: 0,
          completed: true,
          completed_at: new Date(),
          last_seen_at: new Date(),
          last_position_sec: 0,
          pdfCompletedPages: finalCompletedPages,
          pdfTotalPages: totalPages,
          pdfCurrentPage: finalCurrentPage,
        },
        update: {
          completed: true,
          completed_at: new Date(),
          last_seen_at: new Date(),
          pdfCompletedPages: finalCompletedPages,
          pdfTotalPages: totalPages,
          pdfCurrentPage: finalCurrentPage,
        },
      });

      const { courseProgress } = await this.recalcCourseProgress({
        userId,
        courseId: lesson.course_id,
      });

      return {
        lessonMeta: this.buildLessonMeta(lesson),
        lessonProgress: {
          watched_seconds: updated.watched_seconds,
          completed: updated.completed,
          completed_at: updated.completed_at,
          last_position_sec: updated.last_position_sec,
          pdfCompletedPages: (updated as any).pdfCompletedPages ?? 0,
          pdfTotalPages: (updated as any).pdfTotalPages ?? 0,
          pdfCurrentPage: (updated as any).pdfCurrentPage ?? 1,
        },
        courseProgress,
      };
    }

    // Video: chốt 100% với epsilon
    const duration = lesson.duration_seconds ?? 0;

    const mustFull = lastPositionSec >= duration - FINISH_EPSILON_SECONDS;
    const newWatched = mustFull
      ? duration
      : Math.max(prev?.watched_seconds ?? 0, Math.floor(lastPositionSec));
    const completed =
      mustFull ||
      (duration > 0 && newWatched / duration >= LESSON_COMPLETE_THRESHOLD);

    const updated = await this.prisma.userLessonProgress.upsert({
      where: { user_id_lesson_id: { user_id: userId, lesson_id: lessonId } },
      create: {
        user: { connect: { id: userId } },
        lesson: { connect: { id: lessonId } },
        watched_seconds: newWatched,
        completed,
        completed_at: completed ? new Date() : null,
        last_seen_at: new Date(),
        last_position_sec: Math.floor(lastPositionSec),
        // pdfCompletedPages: prev?.pdfCompletedPages ?? 0,
        // pdfTotalPages: prev?.pdfTotalPages ?? 0,
      },
      update: {
        watched_seconds: newWatched,
        completed,
        completed_at: completed
          ? (prev?.completed_at ?? new Date())
          : (prev?.completed_at ?? null),
        last_seen_at: new Date(),
        last_position_sec: Math.floor(lastPositionSec),
      },
    });

    const { courseProgress } = await this.recalcCourseProgress({
      userId,
      courseId: lesson.course_id,
    });

    return {
      lessonMeta: this.buildLessonMeta(lesson),
      lessonProgress: {
        watched_seconds: updated.watched_seconds,
        completed: updated.completed,
        completed_at: updated.completed_at,
        last_position_sec: updated.last_position_sec,
        // pdfCompletedPages: (updated as any).pdfCompletedPages ?? 0,
        // pdfTotalPages: (updated as any).pdfTotalPages ?? 0,
      },
      courseProgress,
    };
  }

  /** MARK violation (video only, giữ nguyên như trước) */
  async markViolation(args: {
    userId: string;
    userRole: string;
    lessonId: string;
    reason: string;
    reset: boolean;
    coverage?: any;
  }) {
    const { userId, userRole, lessonId, reason, reset, coverage } = args;

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        course: {
          include: {
            lessons: { select: { id: true, is_mandatory: true } },
          },
        },
        progresses: { where: { user_id: userId }, take: 1 },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const allowed = lesson.course.allowed_roles || [];
    if (!allowed.includes(userRole) && userRole !== 'admin') {
      throw new ForbiddenException('Not allowed to access this lesson');
    }

    // Non-video: không gắn cờ vi phạm
    if (lesson.type !== 'video') {
      return { ok: true, message: 'No violation for non-video lessons' };
    }

    const now = new Date();
    const progressUpdate: Prisma.UserLessonProgressUpdateInput = {
      violated_at: now,
      violation_reason: reason,
      last_seen_at: now,
    };
    if (typeof coverage !== 'undefined') {
      (progressUpdate as any).coverage_json = coverage as any;
    }
    if (reset) {
      progressUpdate.watched_seconds = 0;
      progressUpdate.last_position_sec = 0;
      progressUpdate.completed = false;
      progressUpdate.completed_at = null;
    }

    const updated = await this.prisma.userLessonProgress.upsert({
      where: { user_id_lesson_id: { user_id: userId, lesson_id: lessonId } },
      create: {
        user_id: userId,
        lesson_id: lessonId,
        watched_seconds: 0,
        completed: false,
        completed_at: null,
        last_seen_at: now,
        last_position_sec: 0,
        violated_at: now,
        violation_reason: reason,
        coverage_json:
          typeof coverage !== 'undefined' ? (coverage as any) : undefined,
        pdfCompletedPages: 0,
        pdfTotalPages: 0,
      },
      update: progressUpdate,
      select: {
        user_id: true,
        lesson_id: true,
        watched_seconds: true,
        completed: true,
        completed_at: true,
        last_position_sec: true,
        violated_at: true,
        violation_reason: true,
        coverage_json: true,
        pdfCompletedPages: true,
        pdfTotalPages: true,
      },
    });

    const { courseProgress } = await this.recalcCourseProgress({
      userId,
      courseId: lesson.course_id,
    });

    return {
      ok: true,
      message: 'Violation marked',
      lessonMeta: this.buildLessonMeta(lesson),
      lessonProgress: updated,
      courseProgress,
    };
  }

  /** Chuẩn hoá metadata cho FE – GIỜ đã có pdf_url trong DB */
  private buildLessonMeta(lesson: any) {
    const origin = process.env.BACKEND_PUBLIC_ORIGIN || 'http://localhost:3000';

    let youtube_url: string | null = null;
    let direct_video_url: string | null = null;
    let pdf_url: string | null = lesson.pdf_url ?? null;

    const rawVideo = lesson.video_url as string | null;

    if (rawVideo) {
      const lower = rawVideo.toLowerCase();
      if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
        youtube_url = rawVideo;
      } else {
        direct_video_url = rawVideo;
      }
    }

    // nếu là PDF mà chưa có pdf_url, build từ pdf_file_id
    if (lesson.type === 'pdf' && !pdf_url) {
      const fid = lesson.pdf_file_id ?? null;
      if (fid) pdf_url = `${origin}/files/${fid}`;
    }

    return {
      id: lesson.id,
      title: lesson.title,
      is_mandatory: lesson.is_mandatory,
      type: lesson.type,
      duration_seconds: lesson.duration_seconds ?? 0,
      video_url: direct_video_url,
      youtube_url,
      pdf_url,
      slide_url: null,
      text_content:
        lesson.type === 'text'
          ? '(Nội dung text tạm thời - cập nhật sau từ DB)'
          : null,
      pdf_file_id: lesson.pdf_file_id ?? null,
    };
  }

  /** Admin tạo bài học – thêm pdf_url */
  async createLessonForAdmin(dto: {
    course_id: string;
    title: string;
    type: 'video' | 'pdf' | 'slide' | 'text';
    duration_seconds: number;
    video_url?: string;
    pdf_url?: string;
    is_mandatory?: boolean;
    order_index?: number;
  }) {
    const data: Prisma.LessonCreateInput = {
      course: { connect: { id: dto.course_id } },
      title: dto.title,
      type: dto.type as any,
      duration_seconds: dto.duration_seconds,
      is_mandatory: dto.is_mandatory ?? true,
      order_index: dto.order_index ?? 1,
      video_url: null,
      // @ts-ignore
      pdf_url: null,
    };

    if (dto.type === 'video') {
      data.video_url = dto.video_url ?? null;
      // @ts-ignore
      data.pdf_url = null;
    } else if (dto.type === 'pdf') {
      // @ts-ignore
      data.pdf_url = dto.pdf_url ?? null;
      data.video_url = null;
    } else {
      data.video_url = dto.video_url ?? null;
      // @ts-ignore
      data.pdf_url = dto.pdf_url ?? null;
    }

    const created = await this.prisma.lesson.create({
      data,
      select: {
        id: true,
        course_id: true,
        title: true,
        type: true,
        duration_seconds: true,
        video_url: true,
        // @ts-ignore
        pdf_url: true,
        is_mandatory: true,
        order_index: true,
        created_at: true,
      },
    });
    return created;
  }

  /** Tính lại % khoá học dựa trên các bài mandatory */
  private async recalcCourseProgress(args: {
    userId: string;
    courseId: string;
  }) {
    const { userId, courseId } = args;

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        lessons: { select: { id: true, is_mandatory: true } },
      },
    });
    if (!course) {
      return {
        courseProgress: {
          completion_percent: 0,
          is_completed: false,
          completed_at: null,
        },
      };
    }

    const mandatoryIds = course.lessons
      // .filter((l) => l.is_mandatory) //lọc khoá bắt buộc
      .map((l) => l.id);

    let completionPercent = 0;
    let courseCompleted = false;

    if (mandatoryIds.length > 0) {
      const mandatoryProgresses = await this.prisma.userLessonProgress.findMany(
        {
          where: { user_id: userId, lesson_id: { in: mandatoryIds } },
          select: { completed: true },
        },
      );
      const done = mandatoryProgresses.filter((p) => p.completed).length;
      completionPercent = (done / mandatoryIds.length) * 100;
      courseCompleted = done === mandatoryIds.length;
    }

    const existing = await this.prisma.userCourseProgress.findUnique({
      where: { user_id_course_id: { user_id: userId, course_id: courseId } },
      select: { completed_at: true },
    });

    const up = await this.prisma.userCourseProgress.upsert({
      where: { user_id_course_id: { user_id: userId, course_id: courseId } },
      create: {
        user_id: userId,
        course_id: courseId,
        completion_percent: new Prisma.Decimal(completionPercent.toFixed(2)),
        is_completed: courseCompleted,
        completed_at: courseCompleted ? new Date() : null,
      },
      update: {
        completion_percent: new Prisma.Decimal(completionPercent.toFixed(2)),
        is_completed: courseCompleted,
        completed_at: courseCompleted
          ? (existing?.completed_at ?? new Date())
          : null,
      },
    });

    return {
      courseProgress: {
        completion_percent: Number(up.completion_percent),
        is_completed: up.is_completed,
        completed_at: up.completed_at,
      },
    };
  }

  /**
   * Gắn 1 File (PDF/Video) vào bài học.
   * - Nếu type = 'pdf' -> set pdf_file_id + pdf_url
   * - Nếu type = 'video' -> set video_url = file.public_url
   */
  async attachFileToLesson(params: {
    lessonId: string;
    fileId: string;
    userId: string; // để sau này nếu muốn ghi log ai là người gán file
  }) {
    const { lessonId, fileId, userId } = params;

    // 1. Check lesson
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, type: true, title: true },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson không tồn tại');
    }

    // 2. Check file
    const file = await this.prisma.file.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        file_name: true,
        mime_type: true,
        public_url: true,
        is_active: true,
      },
    });
    if (!file || !file.is_active) {
      throw new NotFoundException('File không tồn tại hoặc đã bị vô hiệu');
    }

    // URL dùng cho FE:
    // - Nếu là link ngoài: dùng public_url
    // - Nếu là file nội bộ (upload): dùng /files/:fileId
    const fileUrl = file.public_url ?? `/files/${file.id}`;

    let updated;

    // 3. Tuỳ theo type bài học mà set field phù hợp
    if (lesson.type === LessonType.pdf) {
      updated = await this.prisma.lesson.update({
        where: { id: lessonId },
        data: {
          pdf_file_id: file.id,
          pdf_url: fileUrl,
        },
        select: {
          id: true,
          title: true,
          type: true,
          pdf_file_id: true,
          pdf_url: true,
          video_url: true,
        },
      });
    } else if (lesson.type === LessonType.video) {
      updated = await this.prisma.lesson.update({
        where: { id: lessonId },
        data: {
          video_url: fileUrl,
        },
        select: {
          id: true,
          title: true,
          type: true,
          pdf_file_id: true,
          pdf_url: true,
          video_url: true,
        },
      });
    } else {
      // Các type khác (slide/text) tạm thời gán như PDF
      updated = await this.prisma.lesson.update({
        where: { id: lessonId },
        data: {
          pdf_file_id: file.id,
          pdf_url: fileUrl,
        },
        select: {
          id: true,
          title: true,
          type: true,
          pdf_file_id: true,
          pdf_url: true,
          video_url: true,
        },
      });
    }

    // 4. (Tuỳ chọn) ghi activity log – nếu anh muốn sau này tra audit
    await this.prisma.activityLog.create({
      data: {
        user_id: userId,
        action: 'ATTACH_FILE_TO_LESSON',
        target_type: 'lesson',
        target_id: lessonId,
      },
    });

    return updated;
  }

  /**
   * Gỡ file khỏi bài học (KHÔNG xoá record File, chỉ unlink).
   */
  async detachFileFromLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, type: true },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson không tồn tại');
    }

    const data: any = {};
    if (lesson.type === LessonType.pdf) {
      data.pdf_file_id = null;
      data.pdf_url = null;
    } else if (lesson.type === LessonType.video) {
      // nếu video đang dùng file mp4 thì gỡ link file
      data.video_url = null;
    } else {
      data.pdf_file_id = null;
      data.pdf_url = null;
    }

    const updated = await this.prisma.lesson.update({
      where: { id: lessonId },
      data,
      select: {
        id: true,
        title: true,
        type: true,
        pdf_file_id: true,
        pdf_url: true,
        video_url: true,
      },
    });
    return updated;
  }

  /**
   * Gắn link YouTube cho bài học (thường type = 'video').
   */
  async attachYoutubeToLesson(params: {
    lessonId: string;
    youtubeUrl: string;
  }) {
    const { lessonId, youtubeUrl } = params;

    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson không tồn tại');
    }

    // (Nếu cần, anh có thể normalize url tại đây)
    const updated = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        video_url: youtubeUrl,
      },
      select: {
        id: true,
        title: true,
        type: true,
        video_url: true,
      },
    });
    return updated;
  }

  /**
   * Gỡ link YouTube khỏi bài học.
   */
  async detachYoutubeFromLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson không tồn tại');
    }

    const updated = await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { video_url: null },
      select: {
        id: true,
        title: true,
        type: true,
        video_url: true,
      },
    });
    return updated;
  }

  // LẤY DANH SÁCH BÀI HỌC CHO ADMIN
  async listLessonsForAdmin(params: {
    courseId?: string;
    search?: string;
    page: number;
    pageSize: number;
  }) {
    const { courseId, search, page, pageSize } = params;

    const where: any = {};

    if (courseId) {
      where.course_id = courseId;
    }

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.lesson.findMany({
        where,
        orderBy: [
          { course_id: 'asc' },
          { order_index: 'asc' },
          { created_at: 'desc' },
        ],
        skip,
        take,
        select: {
          id: true,
          course_id: true,
          title: true,
          type: true,
          duration_seconds: true,
          order_index: true,
          is_mandatory: true,
          created_at: true,
          updated_at: true,
        },
      }),
      this.prisma.lesson.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
    };
  }
}
