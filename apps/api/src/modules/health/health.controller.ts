import { Controller, Get } from '@nestjs/common';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  @Get()
  async check() {
    const [postgres, redis] = await Promise.allSettled([
      this.prismaHealth.check(),
      this.redisHealth.check(),
    ]);

    const postgresResult =
      postgres.status === 'fulfilled'
        ? postgres.value
        : { status: 'down' as const, message: 'Health check failed' };
    const redisResult =
      redis.status === 'fulfilled'
        ? redis.value
        : { status: 'down' as const, message: 'Health check failed' };

    const isHealthy = postgresResult.status === 'up' && redisResult.status === 'up';

    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        api: { status: 'up' },
        postgres: postgresResult,
        redis: redisResult,
      },
    };
  }
}
