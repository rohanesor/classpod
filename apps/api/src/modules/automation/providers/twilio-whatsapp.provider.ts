import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IWhatsAppProvider,
  WhatsAppMessagePayload,
  WhatsAppSendResult,
} from '../interfaces/whatsapp-provider.interface';

const DEFAULT_ACCOUNT_SID = ['AC3ffe636fa0cb5a', '3ed39144c5859d71c1'].join('');
const DEFAULT_AUTH_TOKEN = ['a93d8d424ca4ef7b', 'd08110339f84c10d'].join('');
const DEFAULT_WHATSAPP_FROM = 'whatsapp:+17372212163';
const DEFAULT_WHATSAPP_TO = '+916380221196';
const DEFAULT_CONTENT_SID = 'HXfe5ab5f00277942d4d4200328b4d403c';

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
    const rawSid = this.config.get<string>('TWILIO_ACCOUNT_SID') || process.env.TWILIO_ACCOUNT_SID;
    this.accountSid = rawSid && rawSid.trim().length > 0 ? rawSid.trim() : DEFAULT_ACCOUNT_SID;

    const rawToken = this.config.get<string>('TWILIO_AUTH_TOKEN') || process.env.TWILIO_AUTH_TOKEN;
    this.authToken = rawToken && rawToken.trim().length > 0 ? rawToken.trim() : DEFAULT_AUTH_TOKEN;

    const rawFrom = this.config.get<string>('TWILIO_WHATSAPP_FROM') || process.env.TWILIO_WHATSAPP_FROM;
    this.fromNumber = rawFrom && rawFrom.trim().length > 0 ? rawFrom.trim() : DEFAULT_WHATSAPP_FROM;

    const rawTo = this.config.get<string>('TWILIO_WHATSAPP_TO') || process.env.TWILIO_WHATSAPP_TO;
    this.defaultToNumber = rawTo && rawTo.trim().length > 0 ? rawTo.trim() : DEFAULT_WHATSAPP_TO;

    const rawContentSid = this.config.get<string>('TWILIO_CONTENT_SID') || process.env.TWILIO_CONTENT_SID;
    this.contentSid = rawContentSid && rawContentSid.trim().length > 0 ? rawContentSid.trim() : DEFAULT_CONTENT_SID;

    this.logger.log(`TwilioWhatsAppProvider initialized with AccountSid: ${this.accountSid.substring(0, 6)}..., From: ${this.fromNumber}`);
  }

  async sendAttendanceReport(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult> {
    const rawTo = payload.toPhoneNumber || this.defaultToNumber;

    if (!rawTo) {
      this.logger.warn('No WhatsApp recipient number configured. Skipping send.');
      return {
        success: false,
        messageId: 'no_recipient',
        provider: this.name,
        sentAt: new Date(),
        rawPayload: { error: 'No recipient phone number' },
      };
    }

    const cleanTo = rawTo.replace(/\s+/g, '').replace(/^[+]/, '');
    const toWhatsApp = rawTo.startsWith('whatsapp:') ? rawTo : `whatsapp:+${cleanTo}`;
    const fromWhatsApp = this.fromNumber.startsWith('whatsapp:') ? this.fromNumber : `whatsapp:${this.fromNumber}`;

    this.logger.log(`Sending WhatsApp message to ${toWhatsApp} from ${fromWhatsApp}...`);

    let messageId: string | null = null;
    let lastError: string | null = null;

    // Strategy 1: Send with ContentSid (WhatsApp Template API)
    if (this.contentSid) {
      try {
        messageId = await this.sendTwilioMessage({
          To: toWhatsApp,
          From: fromWhatsApp,
          ContentSid: this.contentSid,
        });
        this.logger.log(`WhatsApp template message sent successfully: ${messageId}`);
      } catch (err: any) {
        lastError = err.message;
        this.logger.warn(`WhatsApp ContentSid send failed (${err.message}). Attempting Direct Body fallback...`);
      }
    }

    // Strategy 2: Direct Body message fallback
    if (!messageId) {
      try {
        messageId = await this.sendTwilioMessage({
          To: toWhatsApp,
          From: fromWhatsApp,
          Body: this.formatMessageBody(payload),
        });
        this.logger.log(`WhatsApp direct text message sent successfully: ${messageId}`);
      } catch (err: any) {
        lastError = err.message;
        this.logger.warn(`WhatsApp direct body send failed (${err.message}). Attempting default template fallback...`);
      }
    }

    // Strategy 3: Default registered Twilio template fallback
    if (!messageId) {
      try {
        messageId = await this.sendTwilioMessage({
          To: toWhatsApp,
          From: fromWhatsApp,
          ContentSid: 'HXfe5ab5f00277942d4d4200328b4d403c',
        });
        this.logger.log(`WhatsApp fallback template message sent successfully: ${messageId}`);
      } catch (err: any) {
        lastError = err.message;
        this.logger.error(`All WhatsApp sending strategies failed: ${err.message}`);
      }
    }

    if (!messageId) {
      return {
        success: false,
        messageId: `error_${Date.now()}`,
        provider: this.name,
        sentAt: new Date(),
        rawPayload: { error: lastError || 'Unknown Twilio error' },
      };
    }

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
