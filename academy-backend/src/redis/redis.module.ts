import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';

@Global() // giúp dùng ở mọi nơi mà không cần import lại nhiều lần
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
