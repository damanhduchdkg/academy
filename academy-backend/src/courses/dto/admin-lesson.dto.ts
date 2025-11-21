// src/courses/dto/admin-lesson.dto.ts
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { LessonType } from '@prisma/client';

/**
 * DTO dùng khi Admin tạo bài học mới cho khoá học
 */
export class AdminCreateLessonDto {
  @IsUUID()
  course_id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(LessonType)
  type: LessonType; // 'video' | 'pdf' | 'slide' | 'text'

  @IsInt()
  @Min(0)
  duration_seconds: number;

  @IsOptional()
  @IsString()
  video_url?: string;

  @IsOptional()
  @IsString()
  pdf_url?: string;

  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  order_index?: number;
}

/**
 * DTO dùng khi Admin cập nhật bài học
 * (tất cả field đều optional, trừ id truyền trên URL)
 */
export class AdminUpdateLessonDto {
  @IsOptional()
  @IsUUID()
  course_id?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsEnum(LessonType)
  type?: LessonType;

  @IsOptional()
  @IsInt()
  @Min(0)
  duration_seconds?: number;

  @IsOptional()
  @IsString()
  video_url?: string;

  @IsOptional()
  @IsString()
  pdf_url?: string;

  @IsOptional()
  @IsBoolean()
  is_mandatory?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  order_index?: number;
}
