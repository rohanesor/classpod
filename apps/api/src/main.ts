import { Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { RequestContextMiddleware } from './common/observability/request-context.middleware';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);

  // Increase body limit to 10MB for base64 image observations
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, gateway) or any local dev origin
      callback(null, true);
    },
    credentials: true,
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  const requestContext = app.get(RequestContextMiddleware);
  app.use(requestContext.use.bind(requestContext));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = configService.getOrThrow<number>('api.port');
  await app.listen(port, '0.0.0.0');
  new NestLogger('Bootstrap').log(`API listening on port ${port}`);
}

void bootstrap();
