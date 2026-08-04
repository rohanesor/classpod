import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QUEUE_NAMES } from './queue-names';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.getOrThrow<string>('redis.url'),
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFICATION },
      { name: QUEUE_NAMES.AUTOMATION }
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
