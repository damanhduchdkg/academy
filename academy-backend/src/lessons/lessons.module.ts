import { Module } from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisService } from '../shared/redis.service';
import { LessonProgressRepo } from './lesson-progress.repo';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [PrismaModule],
  providers: [LessonsService, PrismaService, RedisService, LessonProgressRepo],
  controllers: [LessonsController],
  exports: [LessonsService],
})
export class LessonsModule {}
