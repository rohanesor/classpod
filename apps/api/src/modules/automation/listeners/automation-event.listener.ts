import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@/common/queues/queue-names';
import { ATTENDANCE_EVENT_NAMES } from '@/modules/attendance/constants/attendance-events';

export interface AttendanceCompletedEventPayload {
  sessionId: string;
  podId: string;
  teacherId: string;
  triggerEvent?: string;
}

@Injectable()
export class AutomationEventListener {
  private readonly logger = new Logger(AutomationEventListener.name);

  constructor(
    @InjectQueue(QUEUE_NAMES.AUTOMATION)
    private readonly automationQueue: Queue
  ) {}

  @OnEvent(ATTENDANCE_EVENT_NAMES.CLOSED)
  async handleAttendanceClosed(payload: AttendanceCompletedEventPayload): Promise<void> {
    await this.enqueueAutomationJob(payload, ATTENDANCE_EVENT_NAMES.CLOSED);
  }

  @OnEvent(ATTENDANCE_EVENT_NAMES.EXPIRED)
  async handleAttendanceExpired(payload: AttendanceCompletedEventPayload): Promise<void> {
    await this.enqueueAutomationJob(payload, ATTENDANCE_EVENT_NAMES.EXPIRED);
  }

  private async enqueueAutomationJob(
    payload: AttendanceCompletedEventPayload,
    triggerEvent: string
  ): Promise<void> {
    this.logger.log(
      `Received ${triggerEvent} for session ${payload.sessionId}. Enqueuing automation job...`
    );

    try {
      const job = await this.automationQueue.add(
        'execute-automation-pipeline',
        {
          sessionId: payload.sessionId,
          podId: payload.podId,
          teacherId: payload.teacherId,
          triggeredBy: triggerEvent,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
        }
      );

      this.logger.log(
        `Successfully enqueued automation job ${job.id} for session ${payload.sessionId}`
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to enqueue automation job for session ${payload.sessionId}: ${err.message}`,
        err.stack
      );
    }
  }
}
