import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@Module({
  controllers: [HealthController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator],
})
export class HealthModule {}
