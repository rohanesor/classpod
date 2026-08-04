import { Injectable, Logger } from '@nestjs/common';
import { NotificationProvider, NotificationPayload } from './notification-provider.interface';

@Injectable()
export class MockNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger(MockNotificationProvider.name);

  async send(payload: NotificationPayload): Promise<{ success: boolean; providerMessageId: string }> {
    this.logger.log(`[Mock Notification Provider] Sending notification to user ${payload.userId} (Priority: ${payload.priority}): "${payload.title}" - "${payload.body}"`);
    return {
      success: true,
      providerMessageId: `mock-msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }
}
