import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '@/common/database/prisma.service';
import { SignalSource, GatewayObservationType } from '@prisma/client';
import { VerificationService } from '../services/verification.service';

@Injectable()
export class ObservationEventListener {
  private readonly logger = new Logger(ObservationEventListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService,
  ) {}

  @OnEvent('gateway.observation.received')
  async handleObservationReceived(payload: {
    gatewayId: string;
    sessionId?: string | null;
    observationType: string;
    observationId: string;
    payload: any;
  }): Promise<void> {
    try {
      // 1. Process BLE_DETECTED observations
      if (payload.observationType === GatewayObservationType.BLE_DETECTED) {
        const studentId = await this.resolveStudentId(payload.payload);
        if (!studentId) {
          this.logger.debug(`Could not resolve student from BLE payload: ${JSON.stringify(payload.payload)}`);
          return;
        }

        const decision = await this.prisma.attendanceDecision.findFirst({
          where: {
            studentId,
            session: {
              status: 'ACTIVE',
              expiresAt: { gt: new Date() },
            },
          },
        });

        if (!decision) {
          this.logger.debug(`No active decision found for student ${studentId}`);
          return;
        }

        await this.verificationService.submitSignal({
          attendanceDecisionId: decision.id,
          source: SignalSource.BLE,
          payload: {
            gatewayId: payload.gatewayId,
            observationId: payload.observationId,
            originalPayload: payload.payload,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // 2. Process PERSON_COUNT (Camera) observations
      if (payload.observationType === GatewayObservationType.PERSON_COUNT) {
        let targetSessionId = payload.sessionId;

        // If no explicit sessionId in event payload, find the active session
        if (!targetSessionId) {
          const activeSession = await this.prisma.attendanceSession.findFirst({
            where: {
              status: 'ACTIVE',
              expiresAt: { gt: new Date() },
            },
            orderBy: { startedAt: 'desc' },
          });
          targetSessionId = activeSession?.id;
        }

        if (!targetSessionId) {
          this.logger.debug('No active attendance session for PERSON_COUNT camera observation');
          return;
        }

        // Find all student decisions for this active session that are CHECKED_IN or PENDING
        const decisions = await this.prisma.attendanceDecision.findMany({
          where: {
            sessionId: targetSessionId,
            status: { in: ['CHECKED_IN', 'PENDING'] },
          },
        });

        this.logger.log(
          `Processing PERSON_COUNT camera observation for session ${targetSessionId} (${decisions.length} student decisions)`
        );

        for (const decision of decisions) {
          await this.verificationService.submitSignal({
            attendanceDecisionId: decision.id,
            source: SignalSource.PERSON_COUNT,
            payload: {
              gatewayId: payload.gatewayId,
              observationId: payload.observationId,
              bytes: payload.payload?.frame_bytes || payload.payload?.bytes,
              timestamp: new Date().toISOString(),
            },
          });
        }
      }
    } catch (err: any) {
      this.logger.error(`Error processing observation for verification: ${err.message}`, err.stack);
    }
  }

  private async resolveStudentId(payload: any): Promise<string | null> {
    if (!payload) return null;

    if (typeof payload.studentId === 'string') return payload.studentId;
    if (typeof payload.userId === 'string') return payload.userId;

    if (typeof payload.email === 'string') {
      const user = await this.prisma.user.findUnique({
        where: { email: payload.email },
        select: { id: true },
      });
      return user?.id ?? null;
    }

    return null;
  }
}
