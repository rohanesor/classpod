import { Injectable, Logger } from '@nestjs/common';
import {
  IWhatsAppProvider,
  WhatsAppMessagePayload,
  WhatsAppSendResult,
} from '../interfaces/whatsapp-provider.interface';

@Injectable()
export class MockWhatsAppProvider implements IWhatsAppProvider {
  readonly name = 'MockWhatsAppProvider';
  private readonly logger = new Logger(MockWhatsAppProvider.name);

  async sendAttendanceReport(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult> {
    const messageId = `wa_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sentAt = new Date();

    this.logger.log(`\n==================================================`);
    this.logger.log(`[WHATSAPP MOCK PROVIDER] Sending Message`);
    this.logger.log(`To Teacher: ${payload.teacherName}`);
    this.logger.log(`Pod: ${payload.podName}`);
    this.logger.log(`Session ID: ${payload.sessionId}`);
    this.logger.log(`--------------------------------------------------`);
    this.logger.log(`MESSAGE BODY:\n${payload.messageBody}`);
    this.logger.log(`--------------------------------------------------`);
    this.logger.log(`ATTACHMENTS (${payload.attachments.length}):`);
    payload.attachments.forEach((att, idx) => {
      this.logger.log(`  [${idx + 1}] ${att.filename} (${att.mimeType}) -> ${att.url}`);
    });
    this.logger.log(`==================================================\n`);

    return {
      success: true,
      messageId,
      provider: this.name,
      sentAt,
      rawPayload: {
        ...payload,
        mockDelivered: true,
      },
    };
  }
}
