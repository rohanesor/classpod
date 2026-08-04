import { AttendanceSession, Pod, User, AttendanceDecision, VerificationSignal } from '@prisma/client';

export type ExtendedDecision = AttendanceDecision & {
  student: User;
  signals?: VerificationSignal[];
};

export type FullAttendanceSessionData = AttendanceSession & {
  pod: Pod;
  teacher: User;
  decisions: ExtendedDecision[];
};

export interface AttendanceReportData {
  session: FullAttendanceSessionData;
  totalEnrolled: number;
  presentCount: number;
  absentCount: number;
  verifiedCount: number;
  pendingCount: number;
  sessionDurationSec: number;
  generatedAt: Date;
}

export interface GeneratedReport {
  filename: string;
  buffer: Buffer;
  mimeType: string;
}

export interface IReportGenerator {
  generate(data: AttendanceReportData): Promise<GeneratedReport>;
}
