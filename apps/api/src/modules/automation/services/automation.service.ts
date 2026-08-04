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

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
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

    const filePath = this.storageService.getFilePath(artifact.storagePath);
    return {
      artifact,
      filePath,
    };
  }

  async getArtifactByPathForDownload(storagePath: string) {
    const artifact = await this.prisma.automationArtifact.findFirst({
      where: { storagePath },
      include: { run: true },
    });

    const filePath = this.storageService.getFilePath(storagePath);
    return {
      artifact,
      filePath,
    };
  }
}
