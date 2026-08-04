import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class PrismaHealthIndicator {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{ status: 'up' | 'down'; message?: string }> {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return { status: 'up' };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
