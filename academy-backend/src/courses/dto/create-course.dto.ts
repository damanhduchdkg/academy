// src/courses/dto/create-course.dto.ts
import {
  IsArray,
  ArrayNotEmpty,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { CourseLevel } from '@prisma/client'; // dùng enum từ Prisma
import { Role } from '../../auth/roles.enum';

export class CreateCourseDto {
  @IsString()
  @MinLength(3)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsEnum(CourseLevel)
  level: CourseLevel; // 'Basic' | 'Advanced'

  @IsBoolean()
  is_required: boolean;

  @IsOptional()
  @IsBoolean()
  is_published?: boolean;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  allowed_roles: Role[];
}