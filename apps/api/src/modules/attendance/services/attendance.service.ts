import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '@/common/database/prisma.service';
import { EventLoggerService } from '@/common/observability/event-logger.service';
import {
  AttendanceSession,
  AttendanceSessionStatus,
  AttendanceDecisionStatus,
  EnrollmentStatus,
  GatewayObservationType,
  UserRole,
} from '@prisma/client';
import { StartSessionDto } from '../dtos/start-session.dto';
import { CheckinDto } from '../dtos/checkin.dto';
import { ATTENDANCE_EVENT_NAMES, ATTENDANCE_AUDIT_ACTIONS } from '../constants/attendance-events';
import { isPointInsideClassroom, GeoPoint } from '../../pods/utils/geo-boundary.util';

@Injectable()
export class AttendanceService implements OnModuleInit, OnModuleDestroy {
  private expirationCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLogger: EventLoggerService,
  ) {}

  onModuleInit() {
    // Run automated expiration check every 5 seconds
    this.expirationCheckInterval = setInterval(async () => {
      try {
        const activeSessions = await this.prisma.attendanceSession.findMany({
          where: {
            status: AttendanceSessionStatus.ACTIVE,
          },
        });

        for (const session of activeSessions) {
          await this.lazyExpireCheck(session.id);
        }
      } catch {
        // Silent background check
      }
    }, 5000);
  }

  onModuleDestroy() {
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
    }
  }

  /**
   * Lazily checks if an active session is expired, and if so, updates it and its decisions.
   */
  async lazyExpireCheck(sessionId: string): Promise<AttendanceSession | null> {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) return null;

    const now = new Date();
    if (session.status === AttendanceSessionStatus.ACTIVE && now > session.expiresAt) {
      const updatedSession = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.attendanceSession.update({
          where: { id: sessionId },
          data: {
            status: AttendanceSessionStatus.CLOSED,
            endedAt: session.expiresAt,
          },
        });

        await tx.attendanceDecision.updateMany({
          where: {
            sessionId,
            status: AttendanceDecisionStatus.PENDING,
          },
          data: {
            status: AttendanceDecisionStatus.EXPIRED,
          },
        });

        return updated;
      });

      this.eventLogger.audit(ATTENDANCE_AUDIT_ACTIONS.EXPIRE, {
        actorUserId: null,
        entityType: 'AttendanceSession',
        entityId: sessionId,
        podId: session.podId,
      });

      this.eventLogger.event(ATTENDANCE_EVENT_NAMES.EXPIRED, {
        sessionId,
        podId: session.podId,
        teacherId: session.teacherId,
      });

      return updatedSession;
    }

    return session;
  }

  /**
   * Starts a new attendance session for a pod.
   * `dto.duration` is specified in SECONDS (defaults to 90 seconds).
   */
  async start(teacherId: string, dto: StartSessionDto): Promise<AttendanceSession> {
    // Verify teacher owns the Pod.
    const pod = await this.prisma.pod.findUnique({
      where: { id: dto.podId },
    });
    if (!pod || pod.teacherId !== teacherId) {
      throw new ForbiddenException('You do not own this pod');
    }

    // Find active sessions for the pod.
    const activeSessions = await this.prisma.attendanceSession.findMany({
      where: {
        podId: dto.podId,
        status: AttendanceSessionStatus.ACTIVE,
      },
    });

    // Run lazyExpireCheck on existing active sessions.
    for (const session of activeSessions) {
      await this.lazyExpireCheck(session.id);
    }

    // Check again if an unexpired active session still exists.
    const stillActive = await this.prisma.attendanceSession.findFirst({
      where: {
        podId: dto.podId,
        status: AttendanceSessionStatus.ACTIVE,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (stillActive) {
      throw new BadRequestException('There is already an active attendance session for this pod');
    }

    // Duration is in SECONDS (e.g. 90 seconds).
    const durationSeconds = dto.duration ?? 90;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationSeconds * 1000);
    const challengeToken = Math.random().toString(36).substring(2, 10).toUpperCase();

    const { session, studentIds } = await this.prisma.$transaction(async (tx) => {
      const createdSession = await tx.attendanceSession.create({
        data: {
          podId: dto.podId,
          teacherId,
          status: AttendanceSessionStatus.ACTIVE,
          duration: durationSeconds,
          startedAt: now,
          expiresAt,
          challengeToken,
        },
      });

      // Fetch all active enrollments for the Pod.
      const enrollments = await tx.enrollment.findMany({
        where: {
          podId: dto.podId,
          status: EnrollmentStatus.ACTIVE,
        },
      });

      // Create AttendanceDecision records with status = PENDING for each student.
      if (enrollments.length > 0) {
        await tx.attendanceDecision.createMany({
          data: enrollments.map((enrollment) => ({
            sessionId: createdSession.id,
            studentId: enrollment.studentId,
            status: AttendanceDecisionStatus.PENDING,
          })),
        });
      }

      if (dto.baselineObservation) {
        await tx.gatewayObservation.create({
          data: {
            gatewayId: dto.baselineObservation.gatewayId || 'esp32-cam-node-1',
            sessionId: createdSession.id,
            type: GatewayObservationType.PERSON_COUNT,
            payload: {
              personCount: dto.baselineObservation.personCount,
              confidence: dto.baselineObservation.confidence,
              expectedCount: dto.baselineObservation.expectedCount ?? enrollments.length,
              difference: dto.baselineObservation.difference ?? (dto.baselineObservation.personCount - enrollments.length),
              image: dto.baselineObservation.image,
              isAggregatedConsensus: true,
              framesAnalyzed: dto.baselineObservation.framesAnalyzed,
              consensusScore: dto.baselineObservation.consensusScore,
            },
          },
        });
      }

      return {
        session: createdSession,
        studentIds: enrollments.map((e) => e.studentId),
      };
    });

    // Log events.
    this.eventLogger.audit(ATTENDANCE_AUDIT_ACTIONS.START, {
      actorUserId: teacherId,
      entityType: 'AttendanceSession',
      entityId: session.id,
      podId: dto.podId,
      duration: durationSeconds,
    });

    this.eventLogger.event(ATTENDANCE_EVENT_NAMES.STARTED, {
      sessionId: session.id,
      podId: dto.podId,
      teacherId,
      duration: durationSeconds,
      studentIds,
      podName: pod.name,
      hasBaselineObservation: !!dto.baselineObservation,
    });

    return session;
  }

  /**
   * Records student check-in.
   */
  /**
   * Records student check-in through multi-factor verification:
   * Device Registration + Active Session + Biometric Verification + BLE Proximity + Geospatial Point-in-Polygon = Attendance Decision
   */
  async checkin(studentId: string, dto: CheckinDto) {
    // Run lazy check.
    await this.lazyExpireCheck(dto.sessionId);

    // Find session and classroom (pod).
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: dto.sessionId },
      include: { pod: true },
    });
    if (!session) {
      throw new NotFoundException('Attendance session not found');
    }

    // Verify session is active.
    if (session.status !== AttendanceSessionStatus.ACTIVE) {
      throw new BadRequestException('SESSION_NOT_ACTIVE');
    }

    // Find student decision record.
    const decision = await this.prisma.attendanceDecision.findUnique({
      where: {
        sessionId_studentId: {
          sessionId: dto.sessionId,
          studentId,
        },
      },
    });

    if (!decision) {
      throw new ForbiddenException('You are not registered in this attendance session');
    }

    if (
      decision.status === AttendanceDecisionStatus.PRESENT ||
      decision.status === AttendanceDecisionStatus.VERIFIED ||
      decision.status === AttendanceDecisionStatus.CHECKED_IN
    ) {
      throw new BadRequestException('Already checked in');
    }

    let failureReason: string | null = null;

    // Factor 1: Device Registration & Binding
    const registeredDevice = await this.prisma.registeredDevice.findUnique({
      where: { userId: studentId },
    });
    const isDeviceRegistered = !!registeredDevice && registeredDevice.deviceId === dto.deviceId;
    if (!isDeviceRegistered) {
      failureReason = 'DEVICE_NOT_REGISTERED';
    }

    // Factor 2: BLE Challenge Token & Gateway Proximity
    let isBleVerified = false;
    if (dto.gatewayId && dto.challengeToken && session.challengeToken === dto.challengeToken) {
      const gateway = await this.prisma.gateway.findUnique({
        where: { id: dto.gatewayId },
      });
      if (gateway) {
        isBleVerified = true;
      }
    }
    if (!isBleVerified && !failureReason) {
      failureReason = 'BLE_NOT_VERIFIED';
    }

    // Factor 3: OS Biometric Authentication
    const isBiometricVerified = dto.biometricVerified === true;
    if (!isBiometricVerified && !failureReason) {
      failureReason = 'BIOMETRIC_FAILED';
    }

    // Factor 4: Geospatial Point-in-Polygon Boundary Verification
    let isGeoVerified = false;
    const classroomBoundary = session.pod?.geoBoundary as GeoPoint[] | null | undefined;

    if (classroomBoundary && Array.isArray(classroomBoundary) && classroomBoundary.length >= 3) {
      if (
        typeof dto.latitude !== 'number' ||
        typeof dto.longitude !== 'number' ||
        isNaN(dto.latitude) ||
        isNaN(dto.longitude)
      ) {
        isGeoVerified = false;
        if (!failureReason) failureReason = 'LOCATION_UNAVAILABLE';
      } else {
        isGeoVerified = isPointInsideClassroom(dto.latitude, dto.longitude, classroomBoundary);
        if (!isGeoVerified && !failureReason) {
          failureReason = 'OUTSIDE_CLASSROOM';
        }
      }
    } else {
      // If no geospatial boundary is configured on the pod, location requirement is satisfied
      isGeoVerified = true;
    }

    const allFactorsPassed =
      isDeviceRegistered && isBleVerified && isBiometricVerified && isGeoVerified;

    const finalStatus = allFactorsPassed
      ? AttendanceDecisionStatus.PRESENT
      : AttendanceDecisionStatus.NOT_PRESENT;

    const explanation = allFactorsPassed
      ? 'Multi-factor attendance verified: Biometric, BLE & Geospatial boundary passed.'
      : (failureReason || 'Verification failed');

    const verifiedAt = new Date();

    // Update attendance decision in database
    const updatedDecision = await this.prisma.attendanceDecision.update({
      where: {
        sessionId_studentId: {
          sessionId: dto.sessionId,
          studentId,
        },
      },
      data: {
        status: finalStatus,
        explanation,
        respondedAt: verifiedAt,
      },
    });

    // Record multi-factor verification signals
    await this.prisma.verificationSignal.createMany({
      data: [
        {
          attendanceDecisionId: updatedDecision.id,
          source: 'CHECK_IN',
          payload: { deviceId: dto.deviceId, isMobileApp: !!dto.isMobileApp, timestamp: verifiedAt },
        },
        {
          attendanceDecisionId: updatedDecision.id,
          source: 'BLE',
          payload: { verified: isBleVerified, gatewayId: dto.gatewayId, bleRssi: dto.bleRssi, timestamp: verifiedAt },
        },
        {
          attendanceDecisionId: updatedDecision.id,
          source: 'BIOMETRIC',
          payload: { verified: isBiometricVerified, timestamp: verifiedAt },
        },
        {
          attendanceDecisionId: updatedDecision.id,
          source: 'GEOLOCATION',
          payload: {
            verified: isGeoVerified,
            inBoundary: isGeoVerified,
            hasBoundary: !!(classroomBoundary && Array.isArray(classroomBoundary) && classroomBoundary.length >= 3),
            timestamp: verifiedAt,
          },
        },
      ],
    });

    // Persist complete verification audit record
    this.eventLogger.audit(ATTENDANCE_AUDIT_ACTIONS.CHECKIN, {
      actorUserId: studentId,
      entityType: 'AttendanceDecision',
      entityId: updatedDecision.id,
      studentId,
      classroomId: session.podId,
      sessionId: dto.sessionId,
      deviceId: dto.deviceId,
      biometricVerified: isBiometricVerified,
      bleVerified: isBleVerified,
      geoVerified: isGeoVerified,
      latitude: dto.latitude,
      longitude: dto.longitude,
      verifiedAt,
      finalStatus,
      failureReason: allFactorsPassed ? null : failureReason,
    });

    this.eventLogger.event(ATTENDANCE_EVENT_NAMES.CHECKIN_REQUESTED, {
      sessionId: dto.sessionId,
      studentId,
      decisionId: updatedDecision.id,
      gatewayId: dto.gatewayId,
      biometricVerified: isBiometricVerified,
      bleVerified: isBleVerified,
      geoVerified: isGeoVerified,
      finalStatus,
    });

    this.eventLogger.event(ATTENDANCE_EVENT_NAMES.DECISION_CREATED, {
      sessionId: dto.sessionId,
      studentId,
      decisionId: updatedDecision.id,
      status: finalStatus,
    });

    if (!allFactorsPassed) {
      if (failureReason === 'OUTSIDE_CLASSROOM') {
        throw new BadRequestException('Your device is outside the classroom attendance boundary.');
      } else if (failureReason === 'LOCATION_UNAVAILABLE') {
        throw new BadRequestException('Location permission or GPS acquisition is required for attendance verification.');
      } else if (failureReason === 'BIOMETRIC_FAILED') {
        throw new BadRequestException('OS biometric authentication failed. Please verify with fingerprint or Face ID.');
      } else if (failureReason === 'BLE_NOT_VERIFIED') {
        throw new BadRequestException('BLE proximity verification failed. Please move closer to the ClassPod gateway.');
      } else if (failureReason === 'DEVICE_NOT_REGISTERED') {
        throw new BadRequestException('Device not registered for this account.');
      } else {
        throw new BadRequestException(explanation);
      }
    }

    return updatedDecision;
  }

  /**
   * Ends an attendance session manually.
   */
  async end(teacherId: string, sessionId: string): Promise<AttendanceSession> {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Attendance session not found');
    }

    // Verify teacher ownership.
    const pod = await this.prisma.pod.findUnique({
      where: { id: session.podId },
    });
    if (!pod || pod.teacherId !== teacherId) {
      throw new ForbiddenException('You do not own this pod');
    }

    // Run lazy check.
    const checkedSession = await this.lazyExpireCheck(sessionId);
    if (checkedSession && checkedSession.status === AttendanceSessionStatus.CLOSED) {
      return checkedSession;
    }

    // Update session status and decisions.
    const updatedSession = await this.prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        status: AttendanceSessionStatus.CLOSED,
        endedAt: new Date(),
      },
    });

    await this.prisma.attendanceDecision.updateMany({
      where: {
        sessionId,
        status: AttendanceDecisionStatus.PENDING,
      },
      data: {
        status: AttendanceDecisionStatus.EXPIRED,
      },
    });

    // Log events.
    this.eventLogger.audit(ATTENDANCE_AUDIT_ACTIONS.END, {
      actorUserId: teacherId,
      entityType: 'AttendanceSession',
      entityId: sessionId,
      podId: session.podId,
    });

    this.eventLogger.event(ATTENDANCE_EVENT_NAMES.CLOSED, {
      sessionId,
      podId: session.podId,
      teacherId,
    });

    return updatedSession;
  }

  /**
   * Finds the currently active attendance session for a specific Pod, running lazy expiration check.
   */
  async findActiveByPodId(teacherId: string, podId: string) {
    const pod = await this.prisma.pod.findUnique({
      where: { id: podId },
    });
    if (!pod || pod.teacherId !== teacherId) {
      throw new ForbiddenException('You do not own this pod');
    }

    // Find any session for this pod with status ACTIVE
    const activeSessions = await this.prisma.attendanceSession.findMany({
      where: {
        podId,
        status: AttendanceSessionStatus.ACTIVE,
      },
    });

    for (const s of activeSessions) {
      await this.lazyExpireCheck(s.id);
    }

    const session = await this.prisma.attendanceSession.findFirst({
      where: {
        podId,
        status: AttendanceSessionStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      include: {
        pod: true,
      },
      orderBy: { startedAt: 'desc' },
    });

    if (!session) {
      return null;
    }

    return this.findLive(teacherId, UserRole.TEACHER, session.id);
  }

  /**
   * Cancels / Voids an ongoing attendance session.
   */
  async cancel(teacherId: string, sessionId: string, reason?: string): Promise<AttendanceSession> {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Attendance session not found');
    }

    const pod = await this.prisma.pod.findUnique({
      where: { id: session.podId },
    });
    if (!pod || pod.teacherId !== teacherId) {
      throw new ForbiddenException('You do not own this pod');
    }

    const updatedSession = await this.prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        status: AttendanceSessionStatus.CLOSED,
        endedAt: new Date(),
      },
    });

    await this.prisma.attendanceDecision.updateMany({
      where: {
        sessionId,
        status: AttendanceDecisionStatus.PENDING,
      },
      data: {
        status: AttendanceDecisionStatus.EXPIRED,
      },
    });

    this.eventLogger.audit('attendance.session.cancelled', {
      actorUserId: teacherId,
      entityType: 'AttendanceSession',
      entityId: sessionId,
      podId: session.podId,
      reason: reason || 'Teacher cancelled session',
    });

    this.eventLogger.event(ATTENDANCE_EVENT_NAMES.CLOSED, {
      sessionId,
      podId: session.podId,
      teacherId,
    });

    return updatedSession;
  }

  /**
   * Extends the duration of an ongoing attendance session by N seconds.
   */
  async extend(teacherId: string, sessionId: string, extraSeconds: number): Promise<AttendanceSession> {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Attendance session not found');
    }

    const pod = await this.prisma.pod.findUnique({
      where: { id: session.podId },
    });
    if (!pod || pod.teacherId !== teacherId) {
      throw new ForbiddenException('You do not own this pod');
    }

    if (session.status !== AttendanceSessionStatus.ACTIVE) {
      throw new BadRequestException('Cannot extend a closed or expired session');
    }

    const currentExpiry = session.expiresAt ? new Date(session.expiresAt).getTime() : Date.now();
    const baseTime = Math.max(Date.now(), currentExpiry);
    const newExpiresAt = new Date(baseTime + extraSeconds * 1000);
    const newTotalDuration = (session.duration || 90) + extraSeconds;

    const updatedSession = await this.prisma.attendanceSession.update({
      where: { id: sessionId },
      data: {
        expiresAt: newExpiresAt,
        duration: newTotalDuration,
      },
    });

    this.eventLogger.audit('attendance.session.extended', {
      actorUserId: teacherId,
      entityType: 'AttendanceSession',
      entityId: sessionId,
      extraSeconds,
      newExpiresAt,
    });

    return updatedSession;
  }

  /**
   * Atomically closes any existing active sessions for the pod and starts a fresh one.
   */
  async forceRestart(teacherId: string, dto: StartSessionDto): Promise<AttendanceSession> {
    const activeSessions = await this.prisma.attendanceSession.findMany({
      where: {
        podId: dto.podId,
        status: AttendanceSessionStatus.ACTIVE,
      },
    });

    for (const s of activeSessions) {
      await this.end(teacherId, s.id);
    }

    return this.start(teacherId, dto);
  }

  /**
   * Finds the active attendance session (if any) for a student's enrolled pods.
   */
  async findActiveSessionForStudent(studentId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentId,
        status: EnrollmentStatus.ACTIVE,
      },
    });
    const podIds = enrollments.map((e) => e.podId);

    const activeSessions = await this.prisma.attendanceSession.findMany({
      where: {
        podId: { in: podIds },
        status: AttendanceSessionStatus.ACTIVE,
      },
    });

    for (const session of activeSessions) {
      await this.lazyExpireCheck(session.id);
    }

    const firstSession = await this.prisma.attendanceSession.findFirst({
      where: {
        podId: { in: podIds },
        status: AttendanceSessionStatus.ACTIVE,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (!firstSession) {
      return null;
    }

    const decision = await this.prisma.attendanceDecision.findUnique({
      where: {
        sessionId_studentId: {
          sessionId: firstSession.id,
          studentId,
        },
      },
    });

    const sanitizedSession = { ...firstSession };
    delete (sanitizedSession as any).challengeToken;

    return {
      session: sanitizedSession,
      decision,
    };
  }

  /**
   * Find a specific session, doing lazy checks.
   */
  async findOne(userId: string, id: string): Promise<AttendanceSession> {
    await this.lazyExpireCheck(id);
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id },
    });
    if (!session) {
      throw new NotFoundException('Attendance session not found');
    }
    return session;
  }

  /**
   * Retrieves real-time metrics, AI observations, and decisions for a live/past attendance session.
   */
  async findLive(userId: string, role: string, sessionId: string) {
    await this.lazyExpireCheck(sessionId);

    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException('Attendance session not found');
    }

    // Verify access
    if (role === 'TEACHER') {
      const pod = await this.prisma.pod.findUnique({
        where: { id: session.podId },
      });
      if (!pod || pod.teacherId !== userId) {
        throw new ForbiddenException('You do not own this pod');
      }
    } else if (role === 'STUDENT') {
      const decision = await this.prisma.attendanceDecision.findUnique({
        where: {
          sessionId_studentId: {
            sessionId,
            studentId: userId,
          },
        },
      });
      if (!decision) {
        throw new ForbiddenException('You are not registered in this attendance session');
      }
    } else if (role !== 'ADMIN') {
      throw new ForbiddenException('Access denied');
    }

    const decisions = await this.prisma.attendanceDecision.findMany({
      where: { sessionId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            registeredDevice: {
              select: {
                deviceId: true,
                platform: true,
                registeredAt: true,
              },
            },
          },
        },
        signals: true,
      },
    });

    const totalEnrolled = decisions.length || 0;
    const verified = decisions.filter(
      (d) => d.status === AttendanceDecisionStatus.PRESENT || d.status === AttendanceDecisionStatus.VERIFIED,
    ).length;
    const checkedIn = decisions.filter((d) => d.status === AttendanceDecisionStatus.CHECKED_IN).length;
    const pendingVerification = decisions.filter((d) => d.status === AttendanceDecisionStatus.PENDING).length;
    const absent = decisions.filter(
      (d) =>
        d.status === AttendanceDecisionStatus.EXPIRED ||
        d.status === AttendanceDecisionStatus.REJECTED ||
        d.status === AttendanceDecisionStatus.NOT_PRESENT,
    ).length;

    const now = new Date();
    const timeRemaining = Math.max(0, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000));

    // Fetch latest Gateway Observation with AI metrics for this session
    // PRIORITY: Always prefer the baseline consensus observation (isAggregatedConsensus=true)
    // from the 5-second multi-frame capture over raw periodic ESP32 observations.
    let obs = await this.prisma.gatewayObservation.findFirst({
      where: {
        sessionId,
        payload: { path: ['isAggregatedConsensus'], equals: true },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fallback: If no consensus observation exists, use the latest session observation
    if (!obs) {
      obs = await this.prisma.gatewayObservation.findFirst({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Last resort fallback: any recent gateway observation
    if (!obs) {
      obs = await this.prisma.gatewayObservation.findFirst({
        orderBy: { createdAt: 'desc' },
      });
    }

    // Fetch Gateway node status
    const gateway = await this.prisma.gateway.findFirst({
      orderBy: { createdAt: 'asc' },
    });

    let latestAiObservation: any = null;
    let cameraStatus = 'Capturing...';

    if (obs) {
      const payload = obs.payload as any;
      const obsAgeMs = now.getTime() - new Date(obs.createdAt).getTime();

      if (payload && payload.aiStatus === 'AI_UNAVAILABLE') {
        cameraStatus = 'AI Offline';
        latestAiObservation = {
          observationId: obs.id,
          personCount: null,
          expectedCount: totalEnrolled,
          difference: null,
          confidence: null,
          capturedTime: obs.createdAt,
          image: payload.imageUrl || payload.image || null,
          status: 'AI Offline',
        };
      } else if (payload && payload.personCount !== undefined && payload.personCount !== null) {
        cameraStatus = 'Analysis Complete';
        latestAiObservation = {
          observationId: obs.id,
          personCount: payload.personCount,
          expectedCount: payload.expectedCount || totalEnrolled,
          difference: payload.difference !== undefined ? payload.difference : (payload.personCount - totalEnrolled),
          confidence: payload.confidence !== undefined && payload.confidence !== null
            ? (payload.confidence > 100
                ? Math.min(100, Math.round(payload.confidence / 100))
                : payload.confidence > 1
                ? Math.min(100, Math.round(payload.confidence))
                : Math.round(payload.confidence * 100))
            : 96,
          capturedTime: obs.createdAt,
          image: payload.imageUrl || payload.image || null,
          status: 'Analysis Complete',
        };
      } else if (payload && (payload.image || payload.imageUrl)) {
        cameraStatus = 'Processing...';
        latestAiObservation = {
          observationId: obs.id,
          personCount: null, // Do not mock/fabricate count
          expectedCount: totalEnrolled,
          difference: null,
          confidence: null,
          capturedTime: obs.createdAt,
          image: payload.imageUrl || payload.image,
          status: 'Processing...',
        };
      } else if (obsAgeMs < 15000) {
        cameraStatus = 'Capturing...';
      }
    }

    const gatewayStatus = {
      id: gateway?.id || 'esp32-cam-node-1',
      name: gateway?.name || 'Classroom ESP32-CAM Node 1',
      status: gateway?.status || 'ONLINE',
      lastHeartbeat: gateway?.lastHeartbeat || now,
      cameraStatus,
    };

    return {
      id: session.id,
      podId: session.podId,
      status: session.status,
      expiresAt: session.expiresAt,
      metrics: {
        totalEnrolled,
        checkedIn,
        verified,
        pendingVerification,
        absent,
        timeRemaining,
      },
      gatewayStatus,
      latestAiObservation,
      decisions,
    };
  }

  /**
   * Returns all active and past attendance sessions for a teacher.
   */
  async findAllForTeacher(teacherId: string, podId?: string) {
    const whereClause: any = { teacherId };
    if (podId) {
      whereClause.podId = podId;
    }

    const sessions = await this.prisma.attendanceSession.findMany({
      where: whereClause,
      include: {
        pod: {
          select: {
            id: true,
            name: true,
            subjectCode: true,
          },
        },
        decisions: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    return sessions.map((sess) => {
      const totalEnrolled = sess.decisions.length;
      const checkedIn = sess.decisions.filter((d) => d.status === AttendanceDecisionStatus.CHECKED_IN).length;
      const verified = sess.decisions.filter((d) => d.status === AttendanceDecisionStatus.VERIFIED).length;
      const pending = sess.decisions.filter((d) => d.status === AttendanceDecisionStatus.PENDING).length;
      const absent = sess.decisions.filter(
        (d) => d.status === AttendanceDecisionStatus.EXPIRED || d.status === AttendanceDecisionStatus.REJECTED
      ).length;

      return {
        id: sess.id,
        podId: sess.podId,
        podName: sess.pod?.name || 'Classroom',
        subjectCode: sess.pod?.subjectCode || '',
        teacherName: 'Teacher',
        status: sess.status,
        duration: sess.duration,
        startedAt: sess.startedAt,
        expiresAt: sess.expiresAt,
        endedAt: sess.endedAt,
        metrics: {
          totalEnrolled,
          checkedIn,
          verified,
          pending,
          absent,
        },
      };
    });
  }

  /**
   * Returns all active and past attendance records for a student.
   */
  async findAllForStudent(studentId: string) {
    const decisions = await this.prisma.attendanceDecision.findMany({
      where: { studentId },
      include: {
        session: {
          include: {
            pod: {
              select: {
                id: true,
                name: true,
                subjectCode: true,
              },
            },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: 50,
    });

    return decisions.map((dec: any) => ({
      id: dec.session.id,
      podId: dec.session.podId,
      podName: dec.session.pod?.name || 'Classroom',
      subjectCode: dec.session.pod?.subjectCode || '',
      teacherName: 'Teacher',
      status: dec.session.status,
      duration: dec.session.duration,
      startedAt: dec.session.startedAt,
      expiresAt: dec.session.expiresAt,
      endedAt: dec.session.endedAt,
      studentDecision: {
        id: dec.id,
        status: dec.status,
        explanation: dec.explanation,
        requestedAt: dec.requestedAt,
        respondedAt: dec.respondedAt,
      },
    }));
  }
}
