import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@/common/database/prisma.service';
import { GatewayService } from '../services/gateway.service';

@Injectable()
export class SessionBindingListener {
  private readonly logger = new Logger(SessionBindingListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gatewayService: GatewayService,
  ) {}

  @OnEvent('attendance.started')
  async handleAttendanceStarted(payload: {
    sessionId: string;
    podId: string;
    teacherId: string;
    podName?: string;
  }): Promise<void> {
    try {
      this.logger.log(`Handling attendance.started for session ${payload.sessionId}`);

      // 1. Fetch Pod to get name/section/semester
      const pod = await this.prisma.pod.findUnique({
        where: { id: payload.podId },
      });

      const podName = payload.podName || pod?.name || 'Classroom Pod';

      // 2. Find matching gateway by classroom or default to first online/available gateway
      let gateway = await this.prisma.gateway.findFirst({
        where: { status: 'ONLINE' },
      });

      if (!gateway) {
        gateway = await this.prisma.gateway.findFirst({
          orderBy: { createdAt: 'asc' },
        });
      }

      if (gateway) {
        // Bind active session
        this.gatewayService.bindSession(gateway.id, payload.sessionId, payload.podId, podName);
        this.logger.log(`Bound Gateway ${gateway.id} (${gateway.name}) to active session ${payload.sessionId}`);

        // AUTOMATIC HARDWARE CAPTURE: Queue capture command so ESP32 executes on next heartbeat!
        await this.gatewayService.requestCapture(gateway.id);
        this.logger.log(`Queued automatic image capture request for Gateway ${gateway.id}`);
      } else {
        this.logger.warn(`No gateway node found to bind session ${payload.sessionId}`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to bind gateway to started session: ${err.message}`, err.stack);
    }
  }

  @OnEvent('attendance.closed')
  async handleAttendanceClosed(payload: { sessionId: string }): Promise<void> {
    this.logger.log(`Unbinding gateway session ${payload.sessionId} (Closed)`);
    this.gatewayService.unbindSessionById(payload.sessionId);
  }

  @OnEvent('attendance.expired')
  async handleAttendanceExpired(payload: { sessionId: string }): Promise<void> {
    this.logger.log(`Unbinding gateway session ${payload.sessionId} (Expired)`);
    this.gatewayService.unbindSessionById(payload.sessionId);
  }
}
