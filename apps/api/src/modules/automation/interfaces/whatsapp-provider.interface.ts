export interface WhatsAppAttachment {
  filename: string;
  mimeType: string;
  storagePath: string;
  url: string;
}

export interface WhatsAppMessagePayload {
  toPhoneNumber?: string;
  teacherName: string;
  podName: string;
  messageBody: string;
  attachments: WhatsAppAttachment[];
  sessionId: string;
  automationRunId: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId: string;
  provider: string;
  sentAt: Date;
  rawPayload: any;
}

export interface IWhatsAppProvider {
  readonly name: string;
  sendAttendanceReport(payload: WhatsAppMessagePayload): Promise<WhatsAppSendResult>;
}

export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';
