import { Injectable } from '@nestjs/common';
import { AttendanceDecisionStatus, SignalSource, VerificationSignal } from '@prisma/client';

export interface PolicyVerdict {
  status: AttendanceDecisionStatus;
  explanation: string;
  policyVersion: string;
}

@Injectable()
export class AttendancePolicyService {
  private readonly CURRENT_POLICY_VERSION = 'v1.0.0-mvp';

  evaluate(signals: VerificationSignal[]): PolicyVerdict {
    const hasCheckIn = signals.some((s) => s.source === SignalSource.CHECK_IN);
    const hasBle = signals.some((s) => s.source === SignalSource.BLE);
    const hasPersonCount = signals.some((s) => s.source === SignalSource.PERSON_COUNT);

    if (hasCheckIn && (hasBle || hasPersonCount)) {
      const sourceName = hasPersonCount && hasBle ? 'Camera & BLE' : hasPersonCount ? 'Camera Observation' : 'BLE Beacon';
      return {
        status: AttendanceDecisionStatus.VERIFIED,
        explanation: `Verified automatically: Student checked in via app and ${sourceName} confirmed classroom presence.`,
        policyVersion: this.CURRENT_POLICY_VERSION,
      };
    }

    if (hasCheckIn) {
      return {
        status: AttendanceDecisionStatus.CHECKED_IN,
        explanation: 'Pending verification: Student checked in via app, waiting for hardware presence signal.',
        policyVersion: this.CURRENT_POLICY_VERSION,
      };
    }

    return {
      status: AttendanceDecisionStatus.PENDING,
      explanation: 'Pending check-in: Waiting for student to confirm presence via app.',
      policyVersion: this.CURRENT_POLICY_VERSION,
    };
  }
}
