import { Injectable, Logger } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { PrismaService } from '../database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

export type EventLogPayload = Record<string, any>;

@Injectable()
export class EventLoggerService {
  private readonly logger = new Logger(EventLoggerService.name);

  constructor(
    private readonly requestContextService: RequestContextService,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  audit(eventName: string, payload: EventLogPayload): void {
    this.logger.log(this.withContext({ eventType: 'audit', eventName, ...payload }));

    const context = this.requestContextService.getContext();
    const requestId = context?.requestId ?? 'system';
    const correlationId = context?.correlationId ?? 'system';

    const { actorUserId, entityType, entityId, ...metadata } = payload;

    this.prisma.auditLog.create({
      data: {
        actorUserId: actorUserId ? String(actorUserId) : null,
        action: eventName,
        entityType: entityType ? String(entityType) : 'System',
        entityId: entityId ? String(entityId) : null,
        requestId,
        correlationId,
        metadata: metadata as any,
      },
    }).catch((err) => {
      this.logger.error(`Failed to write audit log to database: ${err.message}`, err.stack);
    });
  }

  event(eventName: string, payload: EventLogPayload): void {
    this.logger.log(this.withContext({ eventType: 'event', eventName, ...payload }));

    const context = this.requestContextService.getContext();
    const requestId = context?.requestId ?? null;
    const correlationId = context?.correlationId ?? null;

    this.prisma.eventLog.create({
      data: {
        eventName,
        requestId,
        correlationId,
        payload: payload as any,
      },
    }).catch((err) => {
      this.logger.error(`Failed to write event log to database: ${err.message}`, err.stack);
    });

    this.eventEmitter.emit(eventName, payload);
  }

  error(eventName: string, payload: EventLogPayload): void {
    this.logger.error(this.withContext({ eventType: 'error', eventName, ...payload }));
  }

  private withContext(payload: Record<string, unknown>): Record<string, unknown> {
    const context = this.requestContextService.getContext();

    return {
      ...payload,
      requestId: context?.requestId ?? null,
      correlationId: context?.correlationId ?? null,
    };
  }
}
