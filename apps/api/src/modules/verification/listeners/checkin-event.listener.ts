import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SignalSource } from '@prisma/client';
import { VerificationService } from '../services/verification.service';

@Injectable()
export class CheckinEventListener {
  constructor(private readonly verificationService: VerificationService) {}

  @OnEvent('attendance.checkin.requested')
  async handleCheckinRequested(payload: {
    sessionId: string;
    studentId: string;
    decisionId: string;
    gatewayId?: string;
    challengeToken?: string;
  }): Promise<void> {
    // 1. Submit basic check-in signal
    await this.verificationService.submitSignal({
      attendanceDecisionId: payload.decisionId,
      source: SignalSource.CHECK_IN,
      payload: {
        sessionId: payload.sessionId,
        studentId: payload.studentId,
        timestamp: new Date().toISOString(),
      },
    });

    // 2. If BLE verification data was attached, submit BLE signal
    if (payload.gatewayId && payload.challengeToken) {
      await this.verificationService.submitSignal({
        attendanceDecisionId: payload.decisionId,
        source: SignalSource.BLE,
        payload: {
          gatewayId: payload.gatewayId,
          challengeToken: payload.challengeToken,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
}
