import { Injectable } from '@nestjs/common';
import { NotificationPriority } from '@prisma/client';

@Injectable()
export class NotificationTemplateService {
  compile(
    type: string,
    metadata: any,
    customTitle?: string,
    customBody?: string,
  ): { title: string; body: string; priority: NotificationPriority; expiresAt?: Date } {
    let title = customTitle || '';
    let body = customBody || '';
    let priority: NotificationPriority = NotificationPriority.DEFAULT;
    let expiresAt: Date | undefined;

    switch (type) {
      case 'ATTENDANCE_STARTED':
        title = title || 'New Attendance Session Started';
        body = body || `An attendance session has started for Pod "${metadata?.podName || 'Class'}". Please check in before the session expires.`;
        priority = NotificationPriority.HIGH;
        if (metadata?.expiresInSeconds) {
          expiresAt = new Date(Date.now() + metadata.expiresInSeconds * 1000);
        }
        break;
      case 'ATTENDANCE_REMINDER':
        title = title || 'Attendance Reminder';
        body = body || `Reminder: Check-in is still pending for your class "${metadata?.podName || 'Class'}".`;
        priority = NotificationPriority.HIGH;
        break;
      case 'GENERAL':
        title = title || 'New Notification';
        body = body || '';
        priority = NotificationPriority.DEFAULT;
        break;
      case 'SYSTEM':
        title = title || 'System Alert';
        body = body || 'A system message has been received.';
        priority = NotificationPriority.HIGH;
        break;
      default:
        title = title || 'Notification';
        body = body || '';
        priority = NotificationPriority.DEFAULT;
    }

    return { title, body, priority, expiresAt };
  }
}
