import { Inject, Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '@/common/database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@/common/queues/queue-names';
import { StorageService } from '@/common/storage/storage.service';
import {
  IWhatsAppProvider,
  WHATSAPP_PROVIDER,
  WhatsAppAttachment,
} from '../interfaces/whatsapp-provider.interface';
import { AttendanceReportData } from '../interfaces/report-generator.interface';
import { ExcelGeneratorService } from './excel-generator.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { SummaryGeneratorService } from './summary-generator.service';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly excelGenerator: ExcelGeneratorService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly summaryGenerator: SummaryGeneratorService,
    @InjectQueue(QUEUE_NAMES.AUTOMATION)
    private readonly automationQueue: Queue,
    @Inject(WHATSAPP_PROVIDER)
    private readonly whatsappProvider: IWhatsAppProvider
  ) {}

  async getHistoryForTeacher(teacherId: string, limit = 20, offset = 0) {
    const [total, runs] = await Promise.all([
      this.prisma.automationRun.count({ where: { teacherId } }),
      this.prisma.automationRun.findMany({
        where: { teacherId },
        include: {
          session: {
            include: {
              pod: true,
            },
          },
          pod: true,
          artifacts: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      total,
      runs,
      limit,
      offset,
    };
  }

  async getRunById(runId: string) {
    const run = await this.prisma.automationRun.findUnique({
      where: { id: runId },
      include: {
        session: {
          include: {
            pod: true,
          },
        },
        pod: true,
        teacher: true,
        artifacts: true,
      },
    });

    if (!run) {
      throw new NotFoundException(`Automation run ${runId} not found`);
    }

    return run;
  }

  async retriggerRun(runId: string, teacherId: string) {
    const run = await this.getRunById(runId);

    if (run.teacherId !== teacherId) {
      throw new ForbiddenException('You are not authorized to retrigger this automation run');
    }

    this.logger.log(`Retriggering automation run ${runId} for teacher ${teacherId}...`);

    const job = await this.automationQueue.add(
      'execute-automation-pipeline',
      {
        runId: run.id,
        sessionId: run.sessionId,
        podId: run.podId,
        teacherId: run.teacherId,
        triggeredBy: `retrigger_by_${teacherId}`,
      },
      {
        attempts: 3,
        removeOnComplete: true,
      }
    );

    return {
      message: 'Automation retrigger requested successfully',
      jobId: job.id,
      runId: run.id,
    };
  }

  async resendWhatsApp(runId: string, teacherId: string) {
    const run = await this.getRunById(runId);

    if (run.teacherId !== teacherId) {
      throw new ForbiddenException('You are not authorized to resend WhatsApp for this run');
    }

    if (!run.summary) {
      throw new NotFoundException('No summary available to send for this run');
    }

    const attachments: WhatsAppAttachment[] = run.artifacts.map((a) => ({
      filename: a.filename,
      mimeType: a.mimeType,
      storagePath: a.storagePath,
      url: this.storageService.getUrl(a.storagePath),
    }));

    const result = await this.whatsappProvider.sendAttendanceReport({
      teacherName: run.teacher.name,
      podName: run.pod.name,
      messageBody: run.summary,
      attachments,
      sessionId: run.sessionId,
      automationRunId: run.id,
    });

    await this.prisma.automationRun.update({
      where: { id: runId },
      data: {
        whatsappSentAt: result.sentAt,
      },
    });

    return {
      message: 'WhatsApp report resent successfully',
      sentAt: result.sentAt,
      provider: result.provider,
    };
  }

  async getArtifactForDownload(artifactId: string) {
    const artifact = await this.prisma.automationArtifact.findUnique({
      where: { id: artifactId },
      include: { run: true },
    });

    if (!artifact) {
      throw new NotFoundException(`Artifact ${artifactId} not found`);
    }

    // 1. Check if physical file exists on disk
    if (this.storageService.fileExists(artifact.storagePath)) {
      const filePath = this.storageService.getFilePath(artifact.storagePath);
      return {
        artifact,
        filePath,
        buffer: null,
      };
    }

    // 2. File missing on disk (e.g. container volume reset on EC2)
    // Perform On-The-Fly Regeneration from session database records
    this.logger.warn(`Artifact file missing at ${artifact.storagePath}. Regenerating report on the fly...`);

    const run = await this.getRunById(artifact.runId);
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: run.sessionId },
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
      throw new NotFoundException(`Attendance session ${run.sessionId} not found for artifact regeneration`);
    }

    const totalEnrolled = await this.prisma.enrollment.count({
      where: { podId: session.podId, status: 'ACTIVE' },
    });

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

    let generatedBuffer: Buffer;
    if (artifact.type === 'EXCEL_REPORT') {
      const excel = await this.excelGenerator.generate(reportData);
      generatedBuffer = excel.buffer;
    } else if (artifact.type === 'PDF_REPORT') {
      const pdf = await this.pdfGenerator.generate(reportData);
      generatedBuffer = pdf.buffer;
    } else {
      const textSummary = this.summaryGenerator.generateTextSummary(reportData);
      generatedBuffer = Buffer.from(textSummary, 'utf-8');
    }

    // Save regenerated file back to disk storage
    const pathPrefix = `automation/attendance/${session.id}`;
    await this.storageService.upload(
      artifact.filename,
      generatedBuffer,
      artifact.mimeType,
      pathPrefix
    );

    return {
      artifact,
      filePath: null,
      buffer: generatedBuffer,
    };
  }

  async getArtifactByPathForDownload(storagePath: string) {
    const artifact = await this.prisma.automationArtifact.findFirst({
      where: { storagePath },
      include: { run: true },
    });

    if (artifact) {
      return this.getArtifactForDownload(artifact.id);
    }

    const filePath = this.storageService.getFilePath(storagePath);
    return {
      artifact: null,
      filePath,
      buffer: null,
    };
  }
}
