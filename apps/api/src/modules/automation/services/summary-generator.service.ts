import { Injectable } from '@nestjs/common';
import { AttendanceReportData } from '../interfaces/report-generator.interface';

@Injectable()
export class SummaryGeneratorService {
  generateTextSummary(data: AttendanceReportData): string {
    const sessionDate = new Date(data.session.startedAt).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const sessionTime = new Date(data.session.startedAt).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const generatedTimeStr = data.generatedAt.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    return [
      `🎓 *ClassPod Attendance Summary*`,
      `------------------------------------`,
      `📚 *Class*: ${data.session.pod.name} (${data.session.pod.subjectCode})`,
      `👨‍🏫 *Teacher*: ${data.session.teacher.name}`,
      `📅 *Date*: ${sessionDate} at ${sessionTime}`,
      `------------------------------------`,
      `👥 *Total Students Enrolled*: ${data.totalEnrolled}`,
      `✅ *Present*: ${data.presentCount}`,
      `❌ *Absent*: ${data.absentCount}`,
      `🔍 *Verified (BLE/Camera)*: ${data.verifiedCount}`,
      `⏳ *Pending Verification*: ${data.pendingCount}`,
      `⏱️ *Session Duration*: ${data.sessionDurationSec} sec`,
      `------------------------------------`,
      `🤖 *Generated Time*: ${generatedTimeStr}`,
      `------------------------------------`,
      `📎 *Attached*: Attendance.xlsx, Attendance.pdf`,
    ].join('\n');
  }
}
