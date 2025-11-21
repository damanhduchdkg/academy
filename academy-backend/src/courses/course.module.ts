import { forwardRef, Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AdminCoursesController } from './admin-courses.controller';
import { LessonsModule } from '@/lessons/lessons.module';

@Module({
  imports: [PrismaModule, forwardRef(() => LessonsModule)],
  providers: [CoursesService],
  controllers: [CoursesController, AdminCoursesController],
  exports: [CoursesService],
})
export class CoursesModule {}
