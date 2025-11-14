import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor(private readonly config: ConfigService) {
    const url =
      this.config.get<string>('REDIS_URL') || 'redis://127.0.0.1:6379';
    this.client = new Redis(url, {
      // bạn có thể tinh chỉnh thêm option nếu cần
      lazyConnect: false,
      maxRetriesPerRequest: null,
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      await this.client.disconnect();
    }
  }

  // Tiện ích nhanh
  async setJSON(key: string, value: any, ttlSec?: number) {
    const v = JSON.stringify(value);
    if (ttlSec && ttlSec > 0) return this.client.set(key, v, 'EX', ttlSec);
    return this.client.set(key, v);
  }

  async getJSON<T = any>(key: string): Promise<T | null> {
    const v = await this.client.get(key);
    return v ? (JSON.parse(v) as T) : null;
  }

  async del(key: string) {
    return this.client.del(key);
  }
}
