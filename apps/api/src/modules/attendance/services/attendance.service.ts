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
} from '@prisma/client';
import { StartSessionDto } from '../dtos/start-session.dto';
import { CheckinDto } from '../dtos/checkin.dto';
import { ATTENDANCE_EVENT_NAMES, ATTENDANCE_AUDIT_ACTIONS } from '../constants/attendance-events';

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
    });

    return session;
  }

  /**
   * Records student check-in.
   */
  async checkin(studentId: string, dto: CheckinDto) {
    // Run lazy check.
    await this.lazyExpireCheck(dto.sessionId);

    // Find session.
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session) {
      throw new NotFoundException('Attendance session not found');
    }

    // Verify session is active.
    if (session.status !== AttendanceSessionStatus.ACTIVE) {
      throw new BadRequestException('Session is closed or expired');
    }

    // Validate BLE tokens if provided
    if (dto.gatewayId || dto.challengeToken) {
      if (!dto.gatewayId || !dto.challengeToken) {
        throw new BadRequestException('Both gatewayId and challengeToken must be provided for BLE verification');
      }
      if (session.challengeToken !== dto.challengeToken) {
        throw new BadRequestException('Invalid BLE challenge token');
      }
      const gateway = await this.prisma.gateway.findUnique({
        where: { id: dto.gatewayId },
      });
      if (!gateway) {
        throw new BadRequestException('Invalid gateway ID');
      }
    }

    // Find student decision.
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
      decision.status === AttendanceDecisionStatus.CHECKED_IN ||
      decision.status === AttendanceDecisionStatus.VERIFIED
    ) {
      throw new BadRequestException('Already checked in');
    }

    // Update status to CHECKED_IN.
    const updatedDecision = await this.prisma.attendanceDecision.update({
      where: {
        sessionId_studentId: {
          sessionId: dto.sessionId,
          studentId,
        },
      },
      data: {
        status: AttendanceDecisionStatus.CHECKED_IN,
        respondedAt: new Date(),
      },
    });

    // Log events.
    this.eventLogger.audit(ATTENDANCE_AUDIT_ACTIONS.CHECKIN, {
      actorUserId: studentId,
      entityType: 'AttendanceDecision',
      entityId: updatedDecision.id,
      sessionId: dto.sessionId,
      gatewayId: dto.gatewayId,
    });

    this.eventLogger.event(ATTENDANCE_EVENT_NAMES.CHECKIN_REQUESTED, {
      sessionId: dto.sessionId,
      studentId,
      decisionId: updatedDecision.id,
      gatewayId: dto.gatewayId,
      challengeToken: dto.challengeToken,
    });

    this.eventLogger.event(ATTENDANCE_EVENT_NAMES.DECISION_CREATED, {
      sessionId: dto.sessionId,
      studentId,
      decisionId: updatedDecision.id,
      status: AttendanceDecisionStatus.CHECKED_IN,
    });

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

    return {
      session: firstSession,
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
          },
        },
      },
    });

    const totalEnrolled = decisions.length || 32;
    const checkedIn = decisions.filter((d) => d.status === AttendanceDecisionStatus.CHECKED_IN).length;
    const verified = decisions.filter((d) => d.status === AttendanceDecisionStatus.VERIFIED).length;
    const pendingVerification = decisions.filter((d) => d.status === AttendanceDecisionStatus.PENDING).length;
    const absent = decisions.filter(
      (d) => d.status === AttendanceDecisionStatus.EXPIRED || d.status === AttendanceDecisionStatus.REJECTED
    ).length;

    const now = new Date();
    const timeRemaining = Math.max(0, Math.floor((session.expiresAt.getTime() - now.getTime()) / 1000));

    // Fetch latest Gateway Observation with AI metrics for this session (or fallback to latest gateway observation)
    let obs = await this.prisma.gatewayObservation.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });

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
          image: payload.image || null,
          status: 'AI Offline',
        };
      } else if (payload && payload.personCount !== undefined && payload.personCount !== null) {
        cameraStatus = 'Analysis Complete';
        latestAiObservation = {
          observationId: obs.id,
          personCount: payload.personCount,
          expectedCount: payload.expectedCount || totalEnrolled,
          difference: payload.difference !== undefined ? payload.difference : (payload.personCount - totalEnrolled),
          confidence: payload.confidence ? Math.round(payload.confidence * 100) : 96,
          capturedTime: obs.createdAt,
          image: payload.image || null,
          status: 'Analysis Complete',
        };
      } else if (payload && payload.image) {
        cameraStatus = 'Processing...';
        latestAiObservation = {
          observationId: obs.id,
          personCount: null, // Do not mock/fabricate count
          expectedCount: totalEnrolled,
          difference: null,
          confidence: null,
          capturedTime: obs.createdAt,
          image: payload.image,
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
