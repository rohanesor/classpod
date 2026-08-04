export enum UserRole {
  Teacher = 'teacher',
  Student = 'student',
  Admin = 'admin',
}

export enum AttendanceSessionStatus {
  Draft = 'draft',
  Open = 'open',
  Closed = 'closed',
  Cancelled = 'cancelled',
}

export enum AttendanceDecisionStatus {
  Pending = 'pending',
  Present = 'present',
  Absent = 'absent',
  Rejected = 'rejected',
}

export enum GatewayNodeStatus {
  Provisioning = 'provisioning',
  Online = 'online',
  Offline = 'offline',
  Retired = 'retired',
}
