import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator {
  constructor(private readonly config: ConfigService) {}

  async check(): Promise<{ status: 'up' | 'down'; message?: string }> {
    const redis = new Redis(this.config.getOrThrow<string>('redis.url'));
    try {
      await redis.ping();
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      await redis.quit();
    }
  }
}
