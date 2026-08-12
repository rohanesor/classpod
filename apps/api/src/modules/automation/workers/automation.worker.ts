import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '@/common/queues/queue-names';
import { PrismaService } from '@/common/database/prisma.service';
import { StorageService } from '@/common/storage/storage.service';
import { ExcelGeneratorService } from '../services/excel-generator.service';
import { PdfGeneratorService } from '../services/pdf-generator.service';
import { SummaryGeneratorService } from '../services/summary-generator.service';
import {
  IWhatsAppProvider,
  WHATSAPP_PROVIDER,
  WhatsAppAttachment,
} from '../interfaces/whatsapp-provider.interface';
import { AttendanceReportData } from '../interfaces/report-generator.interface';
import { ArtifactType, AutomationRunStatus } from '@prisma/client';

export interface AutomationJobData {
  sessionId: string;
  podId: string;
  teacherId: string;
  triggeredBy: string;
  runId?: string; // If retriggering an existing run
}

@Processor(QUEUE_NAMES.AUTOMATION)
@Injectable()
export class AutomationWorker extends WorkerHost {
  private readonly logger = new Logger(AutomationWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly excelGenerator: ExcelGeneratorService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly summaryGenerator: SummaryGeneratorService,
    @Inject(WHATSAPP_PROVIDER)
    private readonly whatsappProvider: IWhatsAppProvider
  ) {
    super();
  }

  async process(job: Job<AutomationJobData>): Promise<any> {
    const { sessionId, podId, teacherId, triggeredBy } = job.data;
    this.logger.log(`Processing automation job ${job.id} for session ${sessionId}...`);

    let runId = job.data.runId;

    // Step 1: Create or fetch AutomationRun record
    if (!runId) {
      const newRun = await this.prisma.automationRun.create({
        data: {
          sessionId,
          podId,
          teacherId,
          triggeredBy,
          status: AutomationRunStatus.RUNNING,
          startedAt: new Date(),
        },
      });
      runId = newRun.id;
    } else {
      await this.prisma.automationRun.update({
        where: { id: runId },
        data: {
          status: AutomationRunStatus.RUNNING,
          startedAt: new Date(),
          error: null,
        },
      });
    }

    try {
      // Step 2: Fetch full attendance data
      const session = await this.prisma.attendanceSession.findUnique({
        where: { id: sessionId },
        include: {
          pod: true,
          teacher: true,
          decisions: {
            include: {
              student: true,
              signals: true,
            },
          },
        },
      });

      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }

      // Count total enrolled students in the pod
      const totalEnrolled = await this.prisma.enrollment.count({
        where: { podId: session.podId, status: 'ACTIVE' },
      });

      // Calculate attendance metrics
      const decisions = session.decisions;
      const checkedInDecisions = decisions.filter(
        (d) => d.status === 'CHECKED_IN' || d.status === 'VERIFIED'
      );
      const presentCount = checkedInDecisions.length;
      const absentCount = Math.max(0, totalEnrolled - presentCount);
      const verifiedCount = decisions.filter((d) => d.status === 'VERIFIED').length;
      const pendingCount = decisions.filter((d) => d.status === 'CHECKED_IN').length;

      const endedAt = session.endedAt || session.expiresAt || new Date();
      const startedAt = session.startedAt;
      const sessionDurationSec = Math.max(
        0,
        Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)
      );

      const reportData: AttendanceReportData = {
        session: session as any,
        totalEnrolled,
        presentCount,
        absentCount,
        verifiedCount,
        pendingCount,
        sessionDurationSec,
        generatedAt: new Date(),
      };

      const pathPrefix = `automation/attendance/${sessionId}`;
      const attachments: WhatsAppAttachment[] = [];

      // Step 3: Generate & Upload Excel Report
      this.logger.log(`[Automation] Generating Excel report for session ${sessionId}...`);
      const excel = await this.excelGenerator.generate(reportData);
      const excelUpload = await this.storageService.upload(
        'attendance.xlsx',
        excel.buffer,
        excel.mimeType,
        pathPrefix
      );

      await this.prisma.automationArtifact.create({
        data: {
          runId,
          type: ArtifactType.EXCEL_REPORT,
          filename: 'attendance.xlsx',
          mimeType: excel.mimeType,
          storagePath: excelUpload.storagePath,
          sizeBytes: excelUpload.sizeBytes,
        },
      });

      attachments.push({
        filename: 'attendance.xlsx',
        mimeType: excel.mimeType,
        storagePath: excelUpload.storagePath,
        url: excelUpload.url,
      });

      // Step 4: Generate & Upload PDF Report
      this.logger.log(`[Automation] Generating PDF report for session ${sessionId}...`);
      const pdf = await this.pdfGenerator.generate(reportData);
      const pdfUpload = await this.storageService.upload(
        'attendance.pdf',
        pdf.buffer,
        pdf.mimeType,
        pathPrefix
      );

      await this.prisma.automationArtifact.create({
        data: {
          runId,
          type: ArtifactType.PDF_REPORT,
          filename: 'attendance.pdf',
          mimeType: pdf.mimeType,
          storagePath: pdfUpload.storagePath,
          sizeBytes: pdfUpload.sizeBytes,
        },
      });

      attachments.push({
        filename: 'attendance.pdf',
        mimeType: pdf.mimeType,
        storagePath: pdfUpload.storagePath,
        url: pdfUpload.url,
      });

      // Step 5: Generate & Upload AI/Deterministic Text Summary
      this.logger.log(`[Automation] Generating Summary for session ${sessionId}...`);
      const textSummary = this.summaryGenerator.generateTextSummary(reportData);
      const summaryBuffer = Buffer.from(textSummary, 'utf-8');

      const summaryUpload = await this.storageService.upload(
        'summary.txt',
        summaryBuffer,
        'text/plain',
        pathPrefix
      );

      await this.prisma.automationArtifact.create({
        data: {
          runId,
          type: ArtifactType.AI_SUMMARY,
          filename: 'summary.txt',
          mimeType: 'text/plain',
          storagePath: summaryUpload.storagePath,
          sizeBytes: summaryUpload.sizeBytes,
        },
      });

      // Step 6: Trigger WhatsApp Provider
      this.logger.log(`[Automation] Dispatching WhatsApp message via ${this.whatsappProvider.name}...`);
      const teacherPhone = session.teacher.phone || undefined;
      const waResult = await this.whatsappProvider.sendAttendanceReport({
        toPhoneNumber: teacherPhone,
        teacherName: session.teacher.name,
        podName: session.pod.name,
        messageBody: textSummary,
        attachments,
        sessionId,
        automationRunId: runId,
      });

      // Step 7: Update AutomationRun to COMPLETED
      await this.prisma.automationRun.update({
        where: { id: runId },
        data: {
          status: AutomationRunStatus.COMPLETED,
          completedAt: new Date(),
          summary: textSummary,
          whatsappMessage: textSummary,
          whatsappSentAt: waResult.sentAt,
        },
      });

      this.logger.log(`[Automation] Pipeline execution COMPLETED for run ${runId}`);
      return { success: true, runId };
    } catch (err: any) {
      this.logger.error(`[Automation] Pipeline execution FAILED for run ${runId}: ${err.message}`, err.stack);

      await this.prisma.automationRun.update({
        where: { id: runId },
        data: {
          status: AutomationRunStatus.FAILED,
          error: err.message || 'Automation pipeline execution error',
        },
      });

      throw err;
    }
  }
}
