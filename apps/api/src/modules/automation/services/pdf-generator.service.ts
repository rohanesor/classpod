import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  AttendanceReportData,
  GeneratedReport,
  IReportGenerator,
} from '../interfaces/report-generator.interface';

@Injectable()
export class PdfGeneratorService implements IReportGenerator {
  async generate(data: AttendanceReportData): Promise<GeneratedReport> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          const safePodName = data.session.pod.name.replace(/[^a-zA-Z0-9_-]/g, '_');
          const filename = `Attendance_${safePodName}_${data.session.id.substring(0, 8)}.pdf`;

          resolve({
            filename,
            buffer: pdfBuffer,
            mimeType: 'application/pdf',
          });
        });

        // Header Section
        doc
          .fillColor('#0F172A')
          .fontSize(22)
          .font('Helvetica-Bold')
          .text('ClassPod Attendance Report', { align: 'left' });

        doc
          .fillColor('#64748B')
          .fontSize(10)
          .font('Helvetica')
          .text(`Generated on ${data.generatedAt.toLocaleString()}`, { align: 'left' });

        doc.moveDown(1);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#E2E8F0').lineWidth(1).stroke();
        doc.moveDown(1);

        // Metadata Grid
        const startY = doc.y;
        doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold');

        doc.text('Class / Pod Name:', 40, startY);
        doc.font('Helvetica').text(data.session.pod.name, 150, startY);

        doc.font('Helvetica-Bold').text('Subject Code:', 40, startY + 16);
        doc.font('Helvetica').text(data.session.pod.subjectCode, 150, startY + 16);

        doc.font('Helvetica-Bold').text('Teacher:', 40, startY + 32);
        doc.font('Helvetica').text(data.session.teacher.name, 150, startY + 32);

        doc.font('Helvetica-Bold').text('Session ID:', 330, startY);
        doc.font('Helvetica').text(data.session.id, 410, startY);

        doc.font('Helvetica-Bold').text('Started At:', 330, startY + 16);
        doc.font('Helvetica').text(new Date(data.session.startedAt).toLocaleString(), 410, startY + 16);

        doc.font('Helvetica-Bold').text('Duration:', 330, startY + 32);
        doc.font('Helvetica').text(`${data.sessionDurationSec} seconds`, 410, startY + 32);

        doc.y = startY + 60;
        doc.moveDown(0.5);

        // Summary Boxes
        const boxWidth = 95;
        const boxHeight = 45;
        const boxY = doc.y;

        const metrics = [
          { label: 'ENROLLED', value: data.totalEnrolled, color: '#475569' },
          { label: 'PRESENT', value: data.presentCount, color: '#2563EB' },
          { label: 'VERIFIED', value: data.verifiedCount, color: '#16A34A' },
          { label: 'PENDING', value: data.pendingCount, color: '#D97706' },
          { label: 'ABSENT', value: data.absentCount, color: '#DC2626' },
        ];

        metrics.forEach((m, idx) => {
          const boxX = 40 + idx * (boxWidth + 10);
          doc.rect(boxX, boxY, boxWidth, boxHeight).fillAndStroke('#F8FAFC', '#E2E8F0');
          doc.fillColor(m.color).fontSize(16).font('Helvetica-Bold').text(String(m.value), boxX, boxY + 8, { width: boxWidth, align: 'center' });
          doc.fillColor('#64748B').fontSize(8).font('Helvetica-Bold').text(m.label, boxX, boxY + 28, { width: boxWidth, align: 'center' });
        });

        doc.y = boxY + boxHeight + 20;

        // Table Title
        doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text('Student Attendance Breakdown');
        doc.moveDown(0.5);

        // Table Header
        const tableY = doc.y;
        doc.rect(40, tableY, 515, 20).fill('#1E293B');

        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
        doc.text('Student Name', 45, tableY + 5, { width: 140 });
        doc.text('Email', 190, tableY + 5, { width: 140 });
        doc.text('Status', 335, tableY + 5, { width: 70 });
        doc.text('BLE', 410, tableY + 5, { width: 50 });
        doc.text('Camera', 465, tableY + 5, { width: 85 });

        let currentY = tableY + 20;

        // Populate Table Rows
        data.session.decisions.forEach((decision, index) => {
          if (currentY > 750) {
            doc.addPage();
            currentY = 40;
          }

          const rowBg = index % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
          doc.rect(40, currentY, 515, 18).fill(rowBg);

          const signals = decision.signals || [];
          const hasBle = signals.some((s) => s.source === 'BLE');
          const hasCamera = signals.some((s) => s.source === 'PERSON_COUNT');

          doc.fillColor('#334155').fontSize(8).font('Helvetica');
          doc.text(decision.student.name, 45, currentY + 4, { width: 140 });
          doc.text(decision.student.email, 190, currentY + 4, { width: 140 });

          // Color coded status
          const statusColor =
            decision.status === 'VERIFIED'
              ? '#16A34A'
              : decision.status === 'CHECKED_IN'
              ? '#2563EB'
              : '#DC2626';

          doc.fillColor(statusColor).font('Helvetica-Bold').text(decision.status, 335, currentY + 4, { width: 70 });
          doc.fillColor('#475569').font('Helvetica').text(hasBle ? 'Yes' : 'No', 410, currentY + 4, { width: 50 });
          doc.text(hasCamera ? 'Yes' : 'No', 465, currentY + 4, { width: 85 });

          currentY += 18;
        });

        // Footer
        doc.fontSize(8).fillColor('#94A3B8').text('ClassPod Verification & Automation Module', 40, 780, { align: 'center' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
