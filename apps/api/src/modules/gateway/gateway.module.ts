import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GatewayController } from './controllers/gateway.controller';
import { GatewayService } from './services/gateway.service';
import { GatewaySecretGuard } from './guards/gateway-secret.guard';
import { SessionBindingListener } from './listeners/session-binding.listener';
import { YoloDetectionService } from './services/yolo-detection.service';
import { PersonDetectionService } from './services/person-detection.service';

import { StorageModule } from '@/common/storage/storage.module';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [GatewayController],
  providers: [
    GatewayService,
    GatewaySecretGuard,
    SessionBindingListener,
    PersonDetectionService,
    {
      provide: 'IPersonDetector',
      useClass: YoloDetectionService,
    },
  ],
  exports: [GatewayService, 'IPersonDetector', PersonDetectionService],
})
export class GatewayModule {}
