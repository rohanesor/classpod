import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../database/prisma.service';
import { RequestContextService } from './request-context.service';
import { Request, Response } from 'express';

@Injectable()
export class DbRequestLoggerInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const method = request.method;
    const url = request.url;
    const ip = request.ip || request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    const reqContext = this.requestContextService.getContext();
    const requestId = reqContext?.requestId || null;
    const correlationId = reqContext?.correlationId || null;

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - startTime;
          const statusCode = response.statusCode;

          this.saveLog(method, url, statusCode, responseTime, ip, userAgent, requestId, correlationId);
        },
        error: (err: any) => {
          const responseTime = Date.now() - startTime;
          const statusCode = err.status || err.statusCode || 500;

          this.saveLog(method, url, statusCode, responseTime, ip, userAgent, requestId, correlationId);
        },
      }),
    );
  }

  private saveLog(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    ip: string | undefined,
    userAgent: string | undefined,
    requestId: string | null,
    correlationId: string | null,
  ): void {
    this.prisma.requestLog.create({
      data: {
        method,
        url,
        statusCode,
        responseTime,
        ip: ip || null,
        userAgent: userAgent || null,
        requestId,
        correlationId,
      },
    }).catch(() => {
      // Intentionally ignore database logging errors to prevent disrupting the request lifecycle
    });
  }
}
