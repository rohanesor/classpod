export const VERIFICATION_EVENT_NAMES = {
  EVIDENCE_RECEIVED: 'verification.evidence.received',
  ATTENDANCE_VERIFIED: 'verification.attendance.verified',
  ATTENDANCE_PENDING: 'verification.attendance.pending',
  VERIFICATION_UPDATED: 'verification.updated',
} as const;

export const VERIFICATION_AUDIT_ACTIONS = {
  EVIDENCE_STORE: 'verification.evidence.store',
  ATTENDANCE_VERIFY: 'verification.verify',
  VERIFICATION_UPDATE: 'verification.update',
} as const;
