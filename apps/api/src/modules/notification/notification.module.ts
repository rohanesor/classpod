import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';
import { NotificationTemplateService } from './services/notification-template.service';
import { AttendanceEventListener } from './listeners/attendance-event.listener';
import { MockNotificationProvider } from './providers/mock-notification.provider';

@Module({
  imports: [AuthModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationTemplateService,
    AttendanceEventListener,
    {
      provide: 'NOTIFICATION_PROVIDER',
      useClass: MockNotificationProvider,
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
