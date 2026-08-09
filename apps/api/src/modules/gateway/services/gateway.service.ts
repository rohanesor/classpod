import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '@/common/database/prisma.service';
import { EventLoggerService } from '@/common/observability/event-logger.service';
import { Gateway, GatewayNodeStatus, GatewayObservation } from '@prisma/client';
import { HeartbeatDto } from '../dtos/heartbeat.dto';
import { SubmitObservationDto } from '../dtos/submit-observation.dto';
import { GATEWAY_EVENT_NAMES, GATEWAY_AUDIT_ACTIONS } from '../constants/gateway-events';
import { IPersonDetector } from '../interfaces/person-detection.interface';

const OFFLINE_THRESHOLD_MS = 25_000; // 25 seconds threshold for rapid offline status detection

export interface ActiveSessionBinding {
  sessionId: string;
  podId: string;
  podName: string;
  startedAt: Date;
  challengeToken?: string | null;
}

import { StorageService } from '@/common/storage/storage.service';

@Injectable()
export class GatewayService {
  private readonly pendingCommands = new Map<string, string>();
  private readonly activeSessions = new Map<string, ActiveSessionBinding>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLogger: EventLoggerService,
    private readonly storageService: StorageService,
    @Inject('IPersonDetector')
    private readonly personDetector: IPersonDetector,
  ) {}

  /**
   * Bind an active attendance session to a gateway node.
   */
  bindSession(gatewayId: string, sessionId: string, podId: string, podName: string, challengeToken?: string | null): void {
    this.activeSessions.set(gatewayId, {
      sessionId,
      podId,
      podName,
      startedAt: new Date(),
      challengeToken,
    });

    this.eventLogger.audit('gateway.session.bound', {
      entityType: 'Gateway',
      entityId: gatewayId,
      gatewayId,
      sessionId,
      podId,
      podName,
      challengeToken,
    });
  }

  /**
   * Unbind active session from a gateway.
   */
  unbindSession(gatewayId: string): void {
    this.activeSessions.delete(gatewayId);
  }

  /**
   * Unbind active session by session ID across all gateways.
   */
  unbindSessionById(sessionId: string): void {
    for (const [gwId, binding] of this.activeSessions.entries()) {
      if (binding.sessionId === sessionId) {
        this.activeSessions.delete(gwId);
      }
    }
  }

  /**
   * Gets the active session binding for a gateway (if any).
   */
  getActiveSession(gatewayId: string): ActiveSessionBinding | null {
    return this.activeSessions.get(gatewayId) || null;
  }

  /**
   * Session info endpoint data for dashboard.
   */
  async getSessionInfo(gatewayId: string) {
    const binding = this.getActiveSession(gatewayId);
    if (!binding) {
      // Check if there is an active session in DB for fallback
      const activeSession = await this.prisma.attendanceSession.findFirst({
        where: {
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
        include: {
          pod: true,
        },
        orderBy: { startedAt: 'desc' },
      });

      if (activeSession) {
        // Auto-bind as fallback
        this.bindSession(gatewayId, activeSession.id, activeSession.podId, activeSession.pod.name, activeSession.challengeToken);
        const obsCount = await this.prisma.gatewayObservation.count({
          where: { gatewayId, sessionId: activeSession.id },
        });

        return {
          activeSessionId: activeSession.id,
          podId: activeSession.podId,
          podName: activeSession.pod.name,
          startedAt: activeSession.startedAt,
          observationCount: obsCount,
          status: 'ACTIVE',
        };
      }

      return {
        activeSessionId: null,
        podId: null,
        podName: null,
        startedAt: null,
        observationCount: 0,
        status: 'IDLE',
      };
    }

    const obsCount = await this.prisma.gatewayObservation.count({
      where: { gatewayId, sessionId: binding.sessionId },
    });

    return {
      activeSessionId: binding.sessionId,
      podId: binding.podId,
      podName: binding.podName,
      startedAt: binding.startedAt,
      observationCount: obsCount,
      status: 'ACTIVE',
    };
  }

  /**
   * Process a heartbeat from a gateway device.
   * Updates lastHeartbeat and status. Returns gateway with pendingCommand and activeSessionId.
   */
  async heartbeat(dto: HeartbeatDto): Promise<
    Gateway & {
      pendingCommand?: string | null;
      activeSessionId?: string | null;
      captureEnabled?: boolean;
      challengeToken?: string | null;
    }
  > {
    const now = new Date();

    // Check if gateway exists; if not, auto-register on first heartbeat
    let existing = await this.prisma.gateway.findUnique({
      where: { id: dto.gatewayId },
    });

    if (!existing) {
      existing = await this.prisma.gateway.create({
        data: {
          id: dto.gatewayId,
          name: `ESP32 Gateway Node (${dto.gatewayId})`,
          classroom: 'Main Classroom',
          status: GatewayNodeStatus.ONLINE,
          lastHeartbeat: now,
          firmwareVersion: dto.firmwareVersion ?? 'v1.0.0',
        },
      });

      this.eventLogger.audit('gateway.auto_registered', {
        entityType: 'Gateway',
        entityId: dto.gatewayId,
        gatewayId: dto.gatewayId,
        firmwareVersion: dto.firmwareVersion ?? 'v1.0.0',
      });
    }

    const wasOffline = existing.status === GatewayNodeStatus.OFFLINE;

    // Update gateway
    const gateway = await this.prisma.gateway.update({
      where: { id: dto.gatewayId },
      data: {
        status: GatewayNodeStatus.ONLINE,
        lastHeartbeat: now,
        firmwareVersion: dto.firmwareVersion ?? existing.firmwareVersion,
      },
    });

    // Check pending command for this gateway
    const pendingCommand = this.pendingCommands.get(dto.gatewayId) || null;
    if (pendingCommand) {
      this.pendingCommands.delete(dto.gatewayId);
    }

    // Get active session binding (or fallback to active DB session)
    let binding = this.getActiveSession(dto.gatewayId);
    if (!binding) {
      const activeDbSession = await this.prisma.attendanceSession.findFirst({
        where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
        include: { pod: true },
        orderBy: { startedAt: 'desc' },
      });
      if (activeDbSession) {
        this.bindSession(dto.gatewayId, activeDbSession.id, activeDbSession.podId, activeDbSession.pod.name, activeDbSession.challengeToken);
        binding = this.getActiveSession(dto.gatewayId);
      }
    }

    const activeSessionId = binding ? binding.sessionId : null;
    const captureEnabled = !!activeSessionId;

    // Audit & event for heartbeat
    this.eventLogger.audit(GATEWAY_AUDIT_ACTIONS.HEARTBEAT, {
      entityType: 'Gateway',
      entityId: gateway.id,
      gatewayId: gateway.id,
      status: GatewayNodeStatus.ONLINE,
      pendingCommand,
      activeSessionId,
    });

    this.eventLogger.event(GATEWAY_EVENT_NAMES.HEARTBEAT_RECEIVED, {
      gatewayId: gateway.id,
      status: GatewayNodeStatus.ONLINE,
      firmwareVersion: gateway.firmwareVersion,
      pendingCommand,
      activeSessionId,
    });

    // Emit online transition event if was offline
    if (wasOffline) {
      this.eventLogger.audit(GATEWAY_AUDIT_ACTIONS.ONLINE, {
        entityType: 'Gateway',
        entityId: gateway.id,
        gatewayId: gateway.id,
      });

      this.eventLogger.event(GATEWAY_EVENT_NAMES.ONLINE, {
        gatewayId: gateway.id,
      });
    }

    return {
      ...gateway,
      pendingCommand,
      activeSessionId,
      captureEnabled,
      challengeToken: binding ? binding.challengeToken : null,
    };
  }

  /**
   * Queue a capture request command for a gateway device.
   */
  async requestCapture(gatewayId: string): Promise<{ success: boolean; gatewayId: string; status: string }> {
    const gateway = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
    });

    if (!gateway) {
      throw new NotFoundException(`Gateway with ID ${gatewayId} not found`);
    }

    this.pendingCommands.set(gatewayId, 'CAPTURE');

    this.eventLogger.audit('gateway.capture.requested', {
      entityType: 'Gateway',
      entityId: gatewayId,
      gatewayId,
    });

    return {
      success: true,
      gatewayId,
      status: 'REQUESTED',
    };
  }

  /**
   * Returns the latest captured image & AI detection result for a gateway.
   */
  async getLatestImage(gatewayId: string): Promise<{
    observationId: string | null;
    gatewayId: string;
    timestamp: Date | null;
    image: string | null;
    width?: number;
    height?: number;
    bytes?: number;
    aiMetrics?: {
      personCount: number;
      expectedCount: number;
      difference: number;
      confidence: number;
      status: string;
    };
  }> {
    const gateway = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
    });
    if (!gateway) {
      throw new NotFoundException(`Gateway with ID ${gatewayId} not found`);
    }

    const observations = await this.prisma.gatewayObservation.findMany({
      where: { gatewayId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    for (const obs of observations) {
      const payload = obs.payload as any;
      if (payload && payload.image && typeof payload.image === 'string' && payload.image.length > 50) {
        return {
          observationId: obs.id,
          gatewayId: obs.gatewayId,
          timestamp: obs.createdAt,
          image: payload.image,
          width: payload.width || 320,
          height: payload.height || 240,
          bytes: payload.frame_bytes || payload.bytes || 12400,
          aiMetrics: payload.personCount !== undefined ? {
            personCount: payload.personCount,
            expectedCount: payload.expectedCount || 30,
            difference: payload.difference || 0,
            confidence: payload.confidence || 0.95,
            status: payload.aiStatus || 'ANALYSIS_COMPLETE',
          } : undefined,
        };
      }
    }

    return {
      observationId: null,
      gatewayId,
      timestamp: null,
      image: null,
    };
  }

  /**
   * Store a raw observation from a gateway device.
   * Automatically attaches activeSessionId and runs PersonDetectionService if image observation.
   */
  async submitObservation(dto: SubmitObservationDto): Promise<GatewayObservation> {
    // Validate gateway exists; auto-register if missing
    let gateway = await this.prisma.gateway.findUnique({
      where: { id: dto.gatewayId },
    });
    if (!gateway) {
      gateway = await this.prisma.gateway.create({
        data: {
          id: dto.gatewayId,
          name: `ESP32 Gateway Node (${dto.gatewayId})`,
          classroom: 'Main Classroom',
          status: GatewayNodeStatus.ONLINE,
          lastHeartbeat: new Date(),
          firmwareVersion: 'v1.0.0',
        },
      });
    }

    // Auto-resolve sessionId if missing
    let targetSessionId = dto.sessionId ?? null;
    if (!targetSessionId) {
      const binding = this.getActiveSession(dto.gatewayId);
      if (binding) {
        targetSessionId = binding.sessionId;
      } else {
        // Fallback: check active DB session
        const activeDbSession = await this.prisma.attendanceSession.findFirst({
          where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
          orderBy: { startedAt: 'desc' },
        });
        if (activeDbSession) {
          targetSessionId = activeDbSession.id;
        }
      }
    }

    // If targetSessionId provided, validate it exists
    let expectedStudentsCount = 32;
    if (targetSessionId) {
      const session = await this.prisma.attendanceSession.findUnique({
        where: { id: targetSessionId },
        include: {
          decisions: true,
        },
      });
      if (!session) {
        targetSessionId = null;
      } else {
        expectedStudentsCount = Math.max(1, session.decisions.length || 32);
      }
    }

    // Process payload & execute AI person detection if image present
    let finalPayload: any = { ...dto.payload as object };

    if (dto.type === 'PERSON_COUNT' && finalPayload.image && typeof finalPayload.image === 'string') {
      const aiResult = await this.personDetector.detect(
        finalPayload.image,
        expectedStudentsCount,
        finalPayload.frame_bytes,
      );

      const difference = (aiResult.personCount !== null)
        ? (aiResult.personCount - expectedStudentsCount)
        : null;

      finalPayload = {
        ...finalPayload,
        personCount: aiResult.personCount,
        expectedCount: expectedStudentsCount,
        difference,
        confidence: aiResult.confidence,
        processingTimeMs: aiResult.processingTimeMs,
        aiStatus: aiResult.status,
        analyzedAt: aiResult.analyzedAt,
        detections: aiResult.detections || [],
      };
    }

    // Offload heavy camera frame base64 string to StorageService to keep PostgreSQL JSON lean
    if (finalPayload.frame_bytes || finalPayload.image) {
      try {
        const rawBase64 = (finalPayload.frame_bytes || finalPayload.image).replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(rawBase64, 'base64');
        const filename = `frame_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
        const pathPrefix = targetSessionId ? `observations/session_${targetSessionId}` : `observations/gateway_${dto.gatewayId}`;

        const uploadResult = await this.storageService.upload(filename, imageBuffer, 'image/jpeg', pathPrefix);

        finalPayload.imageUrl = uploadResult.url;
        finalPayload.storagePath = uploadResult.storagePath;

        // Remove heavy raw base64 data strings from the DB JSON payload
        delete finalPayload.frame_bytes;
        delete finalPayload.image;
      } catch (err: any) {
        // Log storage upload error but retain metadata payload
        this.eventLogger.audit('gateway.observation.storage_error', { error: err.message });
      }
    }

    // Store observation
    const observation = await this.prisma.gatewayObservation.create({
      data: {
        gatewayId: dto.gatewayId,
        sessionId: targetSessionId,
        type: dto.type,
        payload: finalPayload,
        createdAt: dto.timestamp ? new Date(dto.timestamp) : new Date(),
      },
    });

    // Audit & event
    this.eventLogger.audit(GATEWAY_AUDIT_ACTIONS.OBSERVATION_STORE, {
      entityType: 'GatewayObservation',
      entityId: observation.id,
      gatewayId: dto.gatewayId,
      sessionId: targetSessionId,
      observationType: dto.type,
      personCount: finalPayload.personCount,
    });

    this.eventLogger.event(GATEWAY_EVENT_NAMES.OBSERVATION_RECEIVED, {
      gatewayId: dto.gatewayId,
      sessionId: targetSessionId,
      observationType: dto.type,
      observationId: observation.id,
      payload: finalPayload,
    });

    return observation;
  }

  /**
   * Returns all gateways with lazy offline detection.
   */
  async getStatus(): Promise<Gateway[]> {
    const gateways = await this.prisma.gateway.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const now = Date.now();

    for (const gw of gateways) {
      if (
        gw.status === GatewayNodeStatus.ONLINE &&
        gw.lastHeartbeat &&
        now - gw.lastHeartbeat.getTime() > OFFLINE_THRESHOLD_MS
      ) {
        // Mark offline
        await this.prisma.gateway.update({
          where: { id: gw.id },
          data: { status: GatewayNodeStatus.OFFLINE },
        });

        gw.status = GatewayNodeStatus.OFFLINE;

        this.eventLogger.audit(GATEWAY_AUDIT_ACTIONS.OFFLINE, {
          entityType: 'Gateway',
          entityId: gw.id,
          gatewayId: gw.id,
        });

        this.eventLogger.event(GATEWAY_EVENT_NAMES.OFFLINE, {
          gatewayId: gw.id,
        });
      }
    }

    return gateways;
  }

  /**
   * Returns recent observations for a specific gateway.
   */
  async getObservations(gatewayId: string, limit = 50): Promise<GatewayObservation[]> {
    const gateway = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
    });
    if (!gateway) {
      throw new NotFoundException(`Gateway with ID ${gatewayId} not found`);
    }

    return this.prisma.gatewayObservation.findMany({
      where: { gatewayId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Manually toggle status of gateway (for demo / testing purposes).
   */
  async toggleStatus(gatewayId: string, targetStatus?: GatewayNodeStatus): Promise<Gateway> {
    const existing = await this.prisma.gateway.findUnique({
      where: { id: gatewayId },
    });
    if (!existing) {
      throw new NotFoundException(`Gateway with ID ${gatewayId} not found`);
    }

    const newStatus = targetStatus ?? (existing.status === GatewayNodeStatus.ONLINE ? GatewayNodeStatus.OFFLINE : GatewayNodeStatus.ONLINE);
    const updated = await this.prisma.gateway.update({
      where: { id: gatewayId },
      data: {
        status: newStatus,
        lastHeartbeat: newStatus === GatewayNodeStatus.ONLINE ? new Date() : new Date(Date.now() - 30_000),
      },
    });

    this.eventLogger.audit('gateway.status_toggled', {
      entityType: 'Gateway',
      entityId: gatewayId,
      status: newStatus,
    });

    return updated;
  }
}
