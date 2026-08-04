import { Module } from '@nestjs/common';
import { PodsController } from './controllers/pods.controller';
import { PodsService } from './services/pods.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PodsController],
  providers: [PodsService],
  exports: [PodsService],
})
export class PodsModule {}

