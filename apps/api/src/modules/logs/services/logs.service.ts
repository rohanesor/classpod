import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/database/prisma.service';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRequestLogs(search?: string, status?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { url: { contains: search, mode: 'insensitive' } },
        { method: { contains: search, mode: 'insensitive' } },
        { requestId: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) {
      const statusCode = parseInt(status, 10);
      if (!isNaN(statusCode)) {
        where.statusCode = statusCode;
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.requestLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.requestLog.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAuditLogs(search?: string, action?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { actorUserId: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (action) {
      where.action = action;
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getEventLogs(search?: string, eventName?: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { eventName: { contains: search, mode: 'insensitive' } },
        { correlationId: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (eventName) {
      where.eventName = eventName;
    }

    const [items, total] = await Promise.all([
      this.prisma.eventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.eventLog.count({ where }),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getMetrics() {
    const [users, pods, sessions, decisions, notifications, gateways] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.pod.count(),
      this.prisma.attendanceSession.count(),
      this.prisma.attendanceDecision.count(),
      this.prisma.notification.count(),
      this.prisma.gateway.count(),
    ]);

    return { users, pods, sessions, decisions, notifications, gateways };
  }
}
