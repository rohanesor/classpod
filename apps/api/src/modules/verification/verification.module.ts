import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { VerificationController } from './controllers/verification.controller';
import { VerificationService } from './services/verification.service';
import { AttendancePolicyService } from './services/attendance-policy.service';
import { CheckinEventListener } from './listeners/checkin-event.listener';
import { ObservationEventListener } from './listeners/observation-event.listener';

@Module({
  imports: [AuthModule],
  controllers: [VerificationController],
  providers: [
    VerificationService,
    AttendancePolicyService,
    CheckinEventListener,
    ObservationEventListener,
  ],
  exports: [VerificationService],
})
export class VerificationModule {}
