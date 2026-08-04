import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/common/database/prisma.service';
import { EventLoggerService } from '@/common/observability/event-logger.service';
import { Notification, NotificationStatus, NotificationPriority } from '@prisma/client';
import { NotificationProvider } from '../providers/notification-provider.interface';
import { NotificationTemplateService } from './notification-template.service';
import { NOTIFICATION_EVENT_NAMES, NOTIFICATION_AUDIT_ACTIONS } from '../constants/notification-events';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLogger: EventLoggerService,
    private readonly templateService: NotificationTemplateService,
    @Inject('NOTIFICATION_PROVIDER')
    private readonly provider: NotificationProvider,
  ) {}

  /**
   * Creates a notification, persists it, and triggers mock delivery.
   */
  async create(
    userId: string,
    type: string,
    metadata?: any,
    customTitle?: string,
    customBody?: string,
    customPriority?: NotificationPriority,
    expiresInSeconds?: number,
  ): Promise<Notification> {
    // Validate target user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Compile from template
    const template = this.templateService.compile(type, metadata, customTitle, customBody);
    const finalPriority = customPriority || template.priority;
    let finalExpiresAt = template.expiresAt;
    if (!finalExpiresAt && expiresInSeconds) {
      finalExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);
    }

    // Persist Notification as PENDING
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        type,
        title: template.title,
        body: template.body,
        status: NotificationStatus.PENDING,
        priority: finalPriority,
        expiresAt: finalExpiresAt,
        metadata: metadata || null,
      },
    });

    // Write audit and event logs
    this.eventLogger.audit(NOTIFICATION_AUDIT_ACTIONS.CREATE, {
      actorUserId: null, // System-generated
      entityType: 'Notification',
      entityId: notification.id,
      userId,
      type,
      priority: finalPriority,
    });

    this.eventLogger.event(NOTIFICATION_EVENT_NAMES.CREATED, {
      notificationId: notification.id,
      userId,
      type,
      priority: finalPriority,
    });

    // Trigger mock delivery synchronously (in a deferred way)
    await this.send(notification.id);

    // Return the updated notification record
    return this.prisma.notification.findUniqueOrThrow({
      where: { id: notification.id },
    });
  }

  /**
   * Triggers the notification provider send logic.
   */
  async send(notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) return;

    try {
      const result = await this.provider.send({
        title: notification.title,
        body: notification.body,
        userId: notification.userId,
        type: notification.type,
        priority: notification.priority,
        metadata: notification.metadata,
      });

      if (result.success) {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: {
            status: NotificationStatus.DELIVERED,
            deliveredAt: new Date(),
          },
        });

        this.eventLogger.audit(NOTIFICATION_AUDIT_ACTIONS.SEND, {
          actorUserId: null,
          entityType: 'Notification',
          entityId: notificationId,
          userId: notification.userId,
          status: NotificationStatus.DELIVERED,
          providerMessageId: result.providerMessageId,
        });

        this.eventLogger.event(NOTIFICATION_EVENT_NAMES.SENT, {
          notificationId,
          userId: notification.userId,
          providerMessageId: result.providerMessageId,
        });
      } else {
        throw new Error(result.error || 'Provider rejected notification send');
      }
    } catch (err: any) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
        },
      });

      this.eventLogger.audit(NOTIFICATION_AUDIT_ACTIONS.FAIL, {
        actorUserId: null,
        entityType: 'Notification',
        entityId: notificationId,
        userId: notification.userId,
        status: NotificationStatus.FAILED,
        error: err.message,
      });

      this.eventLogger.event(NOTIFICATION_EVENT_NAMES.FAILED, {
        notificationId,
        userId: notification.userId,
        error: err.message,
      });
    }
  }

  /**
   * Marks a user's notification as read.
   */
  async markAsRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    if (notification.userId !== userId) {
      throw new ForbiddenException('You do not own this notification');
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date(),
      },
    });

    this.eventLogger.audit(NOTIFICATION_AUDIT_ACTIONS.READ, {
      actorUserId: userId,
      entityType: 'Notification',
      entityId: id,
      status: NotificationStatus.READ,
    });

    this.eventLogger.event(NOTIFICATION_EVENT_NAMES.READ, {
      notificationId: id,
      userId,
    });

    return updated;
  }

  /**
   * Retrieves all notifications for a specific user that are not expired.
   */
  async findAllForUser(userId: string): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: {
        userId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
