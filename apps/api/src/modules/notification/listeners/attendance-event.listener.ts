import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class AttendanceEventListener {
  private readonly logger = new Logger(AttendanceEventListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  @OnEvent('attendance.started')
  async handleAttendanceStarted(payload: any): Promise<void> {
    const { studentIds, podName, sessionId, podId, duration } = payload;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      this.logger.warn(`No student recipients found in attendance.started event payload`);
      return;
    }

    this.logger.log(`Processing attendance.started event for session ${sessionId} - generating notifications for ${studentIds.length} students`);

    // Calculate expiry from the attendance session duration in minutes
    const expiresInSeconds = duration ? duration * 60 : undefined;

    const promises = studentIds.map((studentId) =>
      this.notificationService
        .create(
          studentId,
          'ATTENDANCE_STARTED',
          { podName, sessionId, podId, expiresInSeconds },
          undefined,
          undefined,
          undefined,
          expiresInSeconds,
        )
        .catch((err) => {
          this.logger.error(`Failed to generate attendance notification for student ${studentId}: ${err.message}`);
        }),
    );

    await Promise.all(promises);
  }
}
