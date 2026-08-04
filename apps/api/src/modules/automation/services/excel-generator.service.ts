import { Injectable } from '@nestjs/common';
import * as Workbook from 'exceljs';
import {
  AttendanceReportData,
  GeneratedReport,
  IReportGenerator,
} from '../interfaces/report-generator.interface';

@Injectable()
export class ExcelGeneratorService implements IReportGenerator {
  async generate(data: AttendanceReportData): Promise<GeneratedReport> {
    const workbook = new Workbook.Workbook();
    workbook.creator = 'ClassPod Automation';
    workbook.created = data.generatedAt;

    const worksheet = workbook.addWorksheet('Attendance Report', {
      views: [{ showGridLines: true }],
    });

    // Title & Metadata Rows
    worksheet.addRow([`CLASSPOD ATTENDANCE REPORT`]);
    worksheet.addRow([`Pod Name:`, data.session.pod.name]);
    worksheet.addRow([`Subject Code:`, data.session.pod.subjectCode]);
    worksheet.addRow([`Teacher:`, data.session.teacher.name]);
    worksheet.addRow([`Session Date:`, data.session.startedAt.toISOString()]);
    worksheet.addRow([`Generated At:`, data.generatedAt.toISOString()]);
    worksheet.addRow([]); // Empty spacing row

    // Summary Statistics Header
    worksheet.addRow(['SUMMARY METRICS']);
    worksheet.addRow(['Total Enrolled', 'Present', 'Absent', 'Verified', 'Pending', 'Duration (s)']);
    worksheet.addRow([
      data.totalEnrolled,
      data.presentCount,
      data.absentCount,
      data.verifiedCount,
      data.pendingCount,
      data.sessionDurationSec,
    ]);
    worksheet.addRow([]); // Empty spacing row

    // Student Detail Table Columns
    const headerRow = worksheet.addRow([
      'Student Name',
      'Roll Number / Email',
      'Attendance Status',
      'Verification Status',
      'BLE Status',
      'Camera Status',
      'Check-In Time',
    ]);

    // Style Header Row
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1E293B' }, // Dark slate header
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Populate Student Rows
    data.session.decisions.forEach((decision) => {
      const studentName = decision.student.name;
      const rollNumber = decision.student.email;
      const attendanceStatus = decision.status;

      // Extract verification details from signals
      const signals = decision.signals || [];
      const hasBle = signals.some((s) => s.source === 'BLE');
      const hasCamera = signals.some((s) => s.source === 'PERSON_COUNT');

      const isVerified = decision.status === 'VERIFIED';
      const verificationStatus = isVerified
        ? 'VERIFIED'
        : decision.status === 'CHECKED_IN'
        ? 'PENDING'
        : 'UNVERIFIED';

      const bleStatus = hasBle ? 'Detected' : 'Not Detected';
      const cameraStatus = hasCamera ? 'Detected' : 'Not Detected';
      const checkInTime = decision.respondedAt ? decision.respondedAt.toISOString() : '—';

      worksheet.addRow([
        studentName,
        rollNumber,
        attendanceStatus,
        verificationStatus,
        bleStatus,
        cameraStatus,
        checkInTime,
      ]);
    });

    // Auto-fit Column Widths
    worksheet.columns.forEach((column) => {
      let maxLength = 12;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? String(cell.value).length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = Math.min(maxLength + 4, 35);
    });

    const uint8Array = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(uint8Array);

    const safePodName = data.session.pod.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Attendance_${safePodName}_${data.session.id.substring(0, 8)}.xlsx`;

    return {
      filename,
      buffer,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }
}
