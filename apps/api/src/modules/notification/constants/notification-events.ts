export const NOTIFICATION_EVENT_NAMES = {
  CREATED: 'notification.created',
  SENT: 'notification.sent',
  FAILED: 'notification.failed',
  READ: 'notification.read',
} as const;

export const NOTIFICATION_AUDIT_ACTIONS = {
  CREATE: 'notification.create',
  SEND: 'notification.send',
  READ: 'notification.read',
  FAIL: 'notification.fail',
} as const;
