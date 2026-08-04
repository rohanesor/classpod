import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { REQUEST_ID_HEADER } from '@classpod/shared';
import { LoggerModule } from 'nestjs-pino';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { HealthModule } from './modules/health/health.module';
import { LogsModule } from './modules/logs/logs.module';
import { NotificationModule } from './modules/notification/notification.module';
import { PodsModule } from './modules/pods/pods.module';
import { VerificationModule } from './modules/verification/verification.module';
import { AutomationModule } from './modules/automation/automation.module';
import { AppConfigModule } from './common/config/app-config.module';
import { DatabaseModule } from './common/database/database.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ObservabilityModule } from './common/observability/observability.module';
import { QueueModule } from './common/queues/queue.module';
import { DbRequestLoggerInterceptor } from './common/observability/db-request-logger.interceptor';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { TransformInterceptor } from './common/interceptors/transform.interceptor';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('logLevel', 'info'),
          transport:
            config.get<string>('nodeEnv') === 'development'
              ? {
                  target: 'pino-pretty',
                  options: { colorize: true, singleLine: true },
                }
              : undefined,
          genReqId: (req: { headers: Record<string, string | string[] | undefined> }) => {
            const header = req.headers[REQUEST_ID_HEADER];
            return (Array.isArray(header) ? header[0] : header) ?? randomUUID();
          },
          customProps: (req: { headers: Record<string, string | string[] | undefined> }) => {
            const cid = req.headers['x-correlation-id'];
            return { correlationId: Array.isArray(cid) ? cid[0] : cid };
          },
          autoLogging: true,
          quietReqLogger: true,
        },
      }),
    }),
    EventEmitterModule.forRoot(),
    AppConfigModule,
    ObservabilityModule,
    DatabaseModule,
    QueueModule,
    AuthModule,
    PodsModule,
    AttendanceModule,
    NotificationModule,
    GatewayModule,
    VerificationModule,
    AutomationModule,
    DashboardModule,
    AnalyticsModule,
    LogsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: DbRequestLoggerInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
