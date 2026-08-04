import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/common/database/prisma.service';
import { EventLoggerService } from '@/common/observability/event-logger.service';
import { AttendanceDecisionStatus, VerificationSignal } from '@prisma/client';
import { SubmitSignalDto } from '../dtos/submit-signal.dto';
import { AttendancePolicyService } from './attendance-policy.service';
import { VERIFICATION_EVENT_NAMES, VERIFICATION_AUDIT_ACTIONS } from '../constants/verification-events';

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLogger: EventLoggerService,
    private readonly policyService: AttendancePolicyService,
  ) {}

  /**
   * Find an attendance decision by session ID and student ID.
   */
  async findDecisionBySessionAndStudent(sessionId: string, studentId: string) {
    return this.prisma.attendanceDecision.findUnique({
      where: {
        sessionId_studentId: {
          sessionId,
          studentId,
        },
      },
    });
  }

  /**
   * Submit a new verification signal for an attendance decision.
   */
  async submitSignal(dto: SubmitSignalDto): Promise<VerificationSignal> {
    // Validate decision exists
    const decision = await this.prisma.attendanceDecision.findUnique({
      where: { id: dto.attendanceDecisionId },
    });
    if (!decision) {
      throw new NotFoundException(`Attendance decision with ID ${dto.attendanceDecisionId} not found`);
    }

    // Create VerificationSignal
    const signal = await this.prisma.verificationSignal.create({
      data: {
        attendanceDecisionId: dto.attendanceDecisionId,
        source: dto.source,
        payload: dto.payload as any,
      },
    });

    // Log event & audit
    this.eventLogger.audit(VERIFICATION_AUDIT_ACTIONS.EVIDENCE_STORE, {
      entityType: 'VerificationSignal',
      entityId: signal.id,
      attendanceDecisionId: dto.attendanceDecisionId,
      source: dto.source,
    });

    this.eventLogger.event(VERIFICATION_EVENT_NAMES.EVIDENCE_RECEIVED, {
      signalId: signal.id,
      attendanceDecisionId: dto.attendanceDecisionId,
      source: dto.source,
      payload: dto.payload,
    });

    // Run verification evaluation
    await this.evaluateAndUpdate(dto.attendanceDecisionId);

    return signal;
  }

  /**
   * Evaluates policy rules and updates the attendance decision status/explanation.
   */
  async evaluateAndUpdate(decisionId: string): Promise<void> {
    const decision = await this.prisma.attendanceDecision.findUnique({
      where: { id: decisionId },
      include: {
        signals: true,
        session: true,
      },
    });

    if (!decision) return;

    // Do not modify status if it's already in a final state like EXPIRED or REJECTED
    if (
      decision.status === AttendanceDecisionStatus.EXPIRED ||
      decision.status === AttendanceDecisionStatus.REJECTED
    ) {
      return;
    }

    const verdict = this.policyService.evaluate(decision.signals);

    // If status or explanation changed, update decision and write result log
    if (decision.status !== verdict.status || decision.explanation !== verdict.explanation) {
      await this.prisma.attendanceDecision.update({
        where: { id: decisionId },
        data: {
          status: verdict.status,
          explanation: verdict.explanation,
        },
      });

      // Store VerificationResult
      const result = await this.prisma.verificationResult.create({
        data: {
          attendanceDecisionId: decisionId,
          policyVersion: verdict.policyVersion,
        },
      });

      // Audit and Event logging
      if (verdict.status === AttendanceDecisionStatus.VERIFIED) {
        this.eventLogger.audit(VERIFICATION_AUDIT_ACTIONS.ATTENDANCE_VERIFY, {
          entityType: 'AttendanceDecision',
          entityId: decisionId,
          status: verdict.status,
          explanation: verdict.explanation,
          policyVersion: verdict.policyVersion,
        });

        this.eventLogger.event(VERIFICATION_EVENT_NAMES.ATTENDANCE_VERIFIED, {
          attendanceDecisionId: decisionId,
          sessionId: decision.sessionId,
          studentId: decision.studentId,
          status: verdict.status,
          explanation: verdict.explanation,
          resultId: result.id,
        });
      } else {
        this.eventLogger.audit(VERIFICATION_AUDIT_ACTIONS.VERIFICATION_UPDATE, {
          entityType: 'AttendanceDecision',
          entityId: decisionId,
          status: verdict.status,
          explanation: verdict.explanation,
          policyVersion: verdict.policyVersion,
        });

        this.eventLogger.event(VERIFICATION_EVENT_NAMES.ATTENDANCE_PENDING, {
          attendanceDecisionId: decisionId,
          sessionId: decision.sessionId,
          studentId: decision.studentId,
          status: verdict.status,
          explanation: verdict.explanation,
        });
      }

      // Emits general updated event
      this.eventLogger.event(VERIFICATION_EVENT_NAMES.VERIFICATION_UPDATED, {
        attendanceDecisionId: decisionId,
        status: verdict.status,
        explanation: verdict.explanation,
        policyVersion: verdict.policyVersion,
      });
    }
  }

  /**
   * Retrieves an attendance decision with all its verification signals and results.
   */
  async getDecisionWithEvidence(decisionId: string) {
    const decision = await this.prisma.attendanceDecision.findUnique({
      where: { id: decisionId },
      include: {
        signals: { orderBy: { createdAt: 'desc' } },
        results: { orderBy: { createdAt: 'desc' } },
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!decision) {
      throw new NotFoundException(`Attendance decision with ID ${decisionId} not found`);
    }

    return decision;
  }
}
