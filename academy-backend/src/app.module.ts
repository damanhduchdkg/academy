import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { PrismaModule } from '../prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CoursesModule } from './courses/course.module';
import { CoursesService } from './courses/courses.service';
import { CoursesController } from './courses/courses.controller';
import { LessonsModule } from './lessons/lessons.module';

import { ConfigModule } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';
import { FilesModule } from './files/files.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    CoursesModule,
    LessonsModule,
    ConfigModule.forRoot({ isGlobal: true }), // đọc .env (có REDIS_URL)
    RedisModule, // 👈 ĐÂY CHÍNH LÀ “provide RedisService trong AppModule”
    FilesModule,
  ],
  controllers: [AppController, CoursesController],
  providers: [AppService, CoursesService],
})
export class AppModule {}
