import { NestFactory } from '@nestjs/core';
import { Logger as NestLogger } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  new NestLogger('BullMQWorker').log('ClassPod BullMQ Background Worker initialized and processing queues...');

  // Keep process alive for worker task consumption
  process.on('SIGTERM', async () => {
    new NestLogger('BullMQWorker').log('SIGTERM received. Gracefully closing worker...');
    await app.close();
    process.exit(0);
  });
}

void bootstrapWorker();
