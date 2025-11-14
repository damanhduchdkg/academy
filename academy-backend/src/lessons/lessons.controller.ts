import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
  Post,
} from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../admin/admin.guard';
import { CreateLessonDto } from './dto/create-lesson.dto';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsIn,
  IsObject,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

class UpdateProgressDto {
  @Type(() => Number)
  @IsNumber()
  watchedSeconds: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  lastPositionSec?: number;

  // mới: cho phép FE báo vi phạm và gửi coverage (tuỳ chọn)
  @IsBoolean()
  @IsOptional()
  markViolated?: boolean; // true nếu có seek > 5s hoặc rate != 1

  @IsIn(['seek', 'rate', 'both'])
  @IsOptional()
  violationReason?: 'seek' | 'rate' | 'both';

  @IsObject()
  @IsOptional()
  coverage?: Record<string, any>;

  @IsOptional()
  @IsNumber()
  @Min(1)
  pdfCurrentPage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pdfCompletedPages?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pdfTotalPages?: number;
}

class FinalizeDto {
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  lastPositionSec?: number; // currentTime khi ENDED
}
// ---- DTO cho vi phạm ----
class MarkViolationDto {
  @IsString()
  reason!: string; // 'seek' | 'rate' | 'both' | tuỳ bạn

  @IsBoolean()
  reset!: boolean; // true => reset watched về 0

  @IsOptional()
  @IsObject()
  coverage?: any; // snapshot tuỳ chọn
}

@UseGuards(AuthGuard('jwt'))
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get(':lessonId')
  async getLessonDetail(@Req() req: any, @Param('lessonId') lessonId: string) {
    const userId = req.user.user_id;
    const userRole = req.user.role;

    return this.lessonsService.getLessonForUser({
      userId,
      userRole,
      lessonId,
    });
  }

  // @Patch(':lessonId/progress')
  // async updateProgress(
  //   @Req() req: any,
  //   @Param('lessonId') lessonId: string,
  //   @Body() body: UpdateProgressDto,
  // ) {
  //   const userId = req.user.user_id;
  //   const userRole = req.user.role;

  //   // ---- Normalize watchedSeconds ----
  //   let watchedSeconds = Number(body.watchedSeconds);
  //   if (!Number.isFinite(watchedSeconds) || watchedSeconds < 0) {
  //     watchedSeconds = 0;
  //   }

  //   // ---- Normalize lastPositionSec ----
  //   let lastPositionSec = Number(body.lastPositionSec);
  //   if (!Number.isFinite(lastPositionSec) || lastPositionSec < 0) {
  //     lastPositionSec = 0;
  //   }

  //   // ---- Normalize PDF pages (optional) ----
  //   let pdfCompletedPages =
  //     typeof body.pdfCompletedPages === 'number'
  //       ? Math.max(0, Math.floor(body.pdfCompletedPages))
  //       : undefined;

  //   let pdfTotalPages =
  //     typeof body.pdfTotalPages === 'number'
  //       ? Math.max(0, Math.floor(body.pdfTotalPages))
  //       : undefined;

  //   return this.lessonsService.updateLessonProgress({
  //     userId,
  //     userRole,
  //     lessonId,
  //     watchedSeconds,
  //     lastPositionSec,
  //     markViolated: body.markViolated,
  //     violationReason: body.violationReason,
  //     coverage: body.coverage,

  //     // 👇 thêm 2 field cho PDF
  //     pdfCompletedPages,
  //     pdfTotalPages,
  //   });
  // }

  @Patch(':lessonId/progress')
  async updateProgress(
    @Req() req: any,
    @Param('lessonId') lessonId: string,
    @Body() body: UpdateProgressDto,
  ) {
    return this.lessonsService.updateLessonProgress({
      userId: req.user.user_id,
      userRole: req.user.role,
      lessonId,
      watchedSeconds: body.watchedSeconds ?? 0,
      lastPositionSec: body.lastPositionSec ?? 0,
      // 👇 truyền thêm cho service
      pdfCompletedPages: body.pdfCompletedPages,
      pdfTotalPages: body.pdfTotalPages,
      pdfCurrentPage: body.pdfCurrentPage,
      markViolated: body.markViolated,
      violationReason: body.violationReason,
      coverage: body.coverage,
    });
  }

  // Endpoint finalize để “khớp 100%” khi video kết thúc
  @Patch(':lessonId/finalize')
  async finalize(
    @Req() req: any,
    @Param('lessonId') lessonId: string,
    @Body() body: FinalizeDto,
  ) {
    // const userId = req.user.user_id;
    // const userRole = req.user.role;

    // let lastPositionSec = Number(body.lastPositionSec);
    // if (!Number.isFinite(lastPositionSec) || lastPositionSec < 0) {
    //   lastPositionSec = 0;
    // }

    return this.lessonsService.finalizeLesson({
      userId: req.user.user_id,
      userRole: req.user.role,
      lessonId,
      lastPositionSec: body.lastPositionSec ?? 0,
    });
  }

  /**
   * [PATCH] /lessons/:lessonId/violation
   * Đánh dấu bài học là VI PHẠM cho user hiện tại.
   * Body:
   *  {
   *    "reason": "seek>5s|rate!=1|manual",
   *    "reset": true,             // mặc định true, sẽ reset watched_seconds=0, last_position_sec=0, completed=false
   *    "coverage": [[start,end],[...]] // (tùy chọn) lưu snapshot
   *  }
   */
  @Post(':lessonId/violation')
  async markViolation(
    @Req() req: any,
    @Param('lessonId') lessonId: string,
    @Body() body: MarkViolationDto,
  ) {
    const userId = req.user.user_id;
    const userRole = req.user.role;

    // const reason = body?.reason ?? 'manual';
    // const reset = body?.reset ?? true;
    // const coverage = body?.coverage;

    return this.lessonsService.markViolation({
      userId,
      userRole,
      lessonId,
      reason: body.reason,
      reset: body.reset,
      coverage: body.coverage,
    });
  }

  @UseGuards(AdminGuard)
  @Post('admin')
  async createLesson(@Body() body: CreateLessonDto) {
    return this.lessonsService.createLessonForAdmin(body);
  }
}
