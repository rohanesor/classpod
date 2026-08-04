import { HttpException, HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class LoginRateLimiterService implements OnModuleInit {
  private readonly logger = new Logger(LoginRateLimiterService.name);
  private redisClient: Redis | null = null;
  private readonly fallbackAttempts = new Map<string, number[]>();
  private readonly LIMIT = 5;
  private readonly WINDOW_SECONDS = 60;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
        });
        this.redisClient.connect().catch((err) => {
          this.logger.warn(`Redis connection failed for LoginRateLimiter. Falling back to in-memory mode: ${err.message}`);
          this.redisClient = null;
        });
      } catch (err: any) {
        this.logger.warn(`Redis client init error: ${err.message}`);
        this.redisClient = null;
      }
    }
  }

  async isRateLimited(ip: string): Promise<boolean> {
    if (this.redisClient) {
      try {
        const countStr = await this.redisClient.get(`rate_limit:login:${ip}`);
        const count = countStr ? parseInt(countStr, 10) : 0;
        return count >= this.LIMIT;
      } catch {
        // Fall back to in-memory check
      }
    }

    const now = Date.now();
    const windowStart = now - (this.WINDOW_SECONDS * 1000);
    let ipAttempts = this.fallbackAttempts.get(ip) || [];
    ipAttempts = ipAttempts.filter((timestamp) => timestamp > windowStart);
    this.fallbackAttempts.set(ip, ipAttempts);
    return ipAttempts.length >= this.LIMIT;
  }

  async checkLimit(ip: string): Promise<void> {
    const limited = await this.isRateLimited(ip);
    if (limited) {
      throw new HttpException(
        'Too many login attempts. Please try again after 60 seconds.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async increment(ip: string): Promise<void> {
    if (this.redisClient) {
      try {
        const key = `rate_limit:login:${ip}`;
        const current = await this.redisClient.incr(key);
        if (current === 1) {
          await this.redisClient.expire(key, this.WINDOW_SECONDS);
        }
        return;
      } catch {
        // Fall back to in-memory increment
      }
    }

    const now = Date.now();
    const ipAttempts = this.fallbackAttempts.get(ip) || [];
    ipAttempts.push(now);
    this.fallbackAttempts.set(ip, ipAttempts);
  }
}
