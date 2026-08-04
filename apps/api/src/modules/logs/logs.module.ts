import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LogsController } from './controllers/logs.controller';
import { LogsService } from './services/logs.service';

@Module({
  imports: [AuthModule],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}
