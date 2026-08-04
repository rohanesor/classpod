export interface NotificationPayload {
  title: string;
  body: string;
  userId: string;
  type: string;
  priority: string;
  metadata?: any;
}

export interface NotificationProvider {
  send(payload: NotificationPayload): Promise<{ success: boolean; providerMessageId?: string; error?: string }>;
}
