import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IWhatsAppProvider,
  WhatsAppMessagePayload,
  WhatsAppSendResult,
} from '../interfaces/whatsapp-provider.interface';

@Injectable()
export class TwilioWhatsAppProvider implements IWhatsAppProvider {
  readonly name = 'TwilioWhatsAppProvider';
  private readonly logger = new Logger(TwilioWhatsAppProvider.name);

  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly fromNumber: string;
  private readonly defaultToNumber: string;
  private readonly contentSid: string;

  constructor(private readonly config: ConfigService) {
    this.accountSid = this.config.get<string>('TWILIO_ACCOUNT_SID', '');
    this.authToken = this.config.get<string>('TWILIO_AUTH_TOKEN', '');
    this.fromNumber = this.config.get<string>('TWILIO_WHATSAPP_FROM', '');
    this.defaultToNumber = this.config.get<string>('TWILIO_WHATSAPP_TO', '');
    this.contentSid = this.config.get<string>('TWILIO_CONTENT_SID', '');

    if (!this.accountSid || !this.authToken) {
      this.logger.warn('Twilio credentials not configured — WhatsApp messages will fail.');
    }
  }

  async sendAttendanceReport(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult> {
    const toNumber = payload.toPhoneNumber || this.defaultToNumber;

    if (!toNumber) {
      this.logger.warn('No WhatsApp recipient number configured. Skipping send.');
      return {
        success: false,
        messageId: 'no_recipient',
        provider: this.name,
        sentAt: new Date(),
        rawPayload: { error: 'No recipient phone number' },
      };
    }

    const toWhatsApp = toNumber.startsWith('whatsapp:') ? toNumber : `whatsapp:${toNumber}`;
    const fromWhatsApp = this.fromNumber.startsWith('whatsapp:') ? this.fromNumber : `whatsapp:${this.fromNumber}`;

    this.logger.log(`Sending WhatsApp message to ${toWhatsApp} from ${fromWhatsApp}...`);

    try {
      // Step 1: Send the content template message (summary)
      const messageId = await this.sendTwilioMessage({
        To: toWhatsApp,
        From: fromWhatsApp,
        ...(this.contentSid
          ? { ContentSid: this.contentSid }
          : { Body: this.formatMessageBody(payload) }),
      });

      this.logger.log(`WhatsApp summary message sent: ${messageId}`);

      // Step 2: Send attachment files as separate media messages
      for (const attachment of payload.attachments) {
        if (attachment.url) {
          try {
            const attachmentId = await this.sendTwilioMessage({
              To: toWhatsApp,
              From: fromWhatsApp,
              Body: `📎 ${attachment.filename}`,
              MediaUrl: attachment.url,
            });
            this.logger.log(`WhatsApp attachment sent (${attachment.filename}): ${attachmentId}`);
          } catch (attachErr: any) {
            this.logger.warn(`Failed to send attachment ${attachment.filename}: ${attachErr?.message || attachErr}`);
          }
        }
      }

      return {
        success: true,
        messageId,
        provider: this.name,
        sentAt: new Date(),
        rawPayload: { to: toWhatsApp, from: fromWhatsApp, messageId },
      };
    } catch (err: any) {
      this.logger.error(`Twilio WhatsApp send failed: ${err.message}`, err.stack);
      return {
        success: false,
        messageId: `error_${Date.now()}`,
        provider: this.name,
        sentAt: new Date(),
        rawPayload: { error: err.message },
      };
    }
  }

  private async sendTwilioMessage(params: Record<string, string>): Promise<string> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const authHeader = 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      body.append(key, value);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: authHeader,
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Twilio API error ${response.status}: ${data.message || JSON.stringify(data)}`);
    }

    return data.sid;
  }

  private formatMessageBody(payload: WhatsAppMessagePayload): string {
    return [
      `📊 *ClassPod Attendance Report*`,
      ``,
      `👨‍🏫 *Teacher:* ${payload.teacherName}`,
      `📚 *Class:* ${payload.podName}`,
      ``,
      payload.messageBody,
      ``,
      `📎 *Attachments:* ${payload.attachments.length} file(s)`,
      payload.attachments.map((a) => `  • ${a.filename}`).join('\n'),
    ].join('\n');
  }
}
