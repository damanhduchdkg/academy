import { PartialType } from '@nestjs/mapped-types';
import { CreateCourseDto } from './create-course.dto';
import { CourseLevel } from '@prisma/client';
import { Role } from '../../auth/roles.enum';

export class UpdateCourseDto extends PartialType(CreateCourseDto) {
  description?: string;
  category?: string;
  level?: CourseLevel;
  is_required?: boolean;
  is_published?: boolean;
  allowed_roles?: Role[];
}