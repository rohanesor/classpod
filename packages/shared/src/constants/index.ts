export const CLASSPOD_APP_NAME = 'ClassPod';

export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';

export const EVENT_NAMES = {
  attendanceSessionCreated: 'attendance.session.created',
  attendanceConfirmationReceived: 'attendance.confirmation.received',
  gatewayPresenceObserved: 'gateway.presence.observed',
  auditRecordWritten: 'audit.record.written',
} as const;
