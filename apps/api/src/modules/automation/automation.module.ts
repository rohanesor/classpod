import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { QUEUE_NAMES } from '@/common/queues/queue-names';
import { StorageModule } from '@/common/storage/storage.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { WHATSAPP_PROVIDER } from './interfaces/whatsapp-provider.interface';
import { TwilioWhatsAppProvider } from './providers/twilio-whatsapp.provider';
import { ExcelGeneratorService } from './services/excel-generator.service';
import { PdfGeneratorService } from './services/pdf-generator.service';
import { SummaryGeneratorService } from './services/summary-generator.service';
import { AutomationEventListener } from './listeners/automation-event.listener';
import { AutomationWorker } from './workers/automation.worker';
import { AutomationService } from './services/automation.service';
import { AutomationController } from './controllers/automation.controller';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.AUTOMATION }),
    StorageModule,
    AuthModule,
    ConfigModule,
  ],
  providers: [
    {
      provide: WHATSAPP_PROVIDER,
      useClass: TwilioWhatsAppProvider,
    },
    ExcelGeneratorService,
    PdfGeneratorService,
    SummaryGeneratorService,
    AutomationEventListener,
    AutomationWorker,
    AutomationService,
  ],
  controllers: [AutomationController],
  exports: [AutomationService],
})
export class AutomationModule {}
