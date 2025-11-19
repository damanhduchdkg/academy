import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisService } from '../shared/redis.service';
import { LessonProgressRepo } from './lesson-progress.repo';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminLessonsController } from './admin-lessons.controller';

@Module({
  imports: [PrismaModule],
  providers: [LessonsService, PrismaService, RedisService, LessonProgressRepo],
  controllers: [LessonsController, AdminLessonsController],
  exports: [LessonsService],
})
export class LessonsModule {}
