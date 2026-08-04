export const ATTENDANCE_EVENT_NAMES = {
  STARTED: 'attendance.started',
  CHECKIN_REQUESTED: 'attendance.checkin.requested',
  CLOSED: 'attendance.closed',
  EXPIRED: 'attendance.expired',
  DECISION_CREATED: 'attendance.decision.created',
} as const;

export const ATTENDANCE_AUDIT_ACTIONS = {
  START: 'attendance.start',
  END: 'attendance.end',
  CHECKIN: 'attendance.checkin',
  EXPIRE: 'attendance.expire',
} as const;
