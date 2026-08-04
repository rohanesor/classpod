import { Global, Module } from '@nestjs/common';
import { EventLoggerService } from './event-logger.service';
import { RequestContextMiddleware } from './request-context.middleware';
import { RequestContextService } from './request-context.service';

@Global()
@Module({
  providers: [RequestContextService, RequestContextMiddleware, EventLoggerService],
  exports: [RequestContextService, RequestContextMiddleware, EventLoggerService],
})
export class ObservabilityModule {}
