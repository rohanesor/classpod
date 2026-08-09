import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { ErrorEnvelope } from '@classpod/shared';
import type { Response } from 'express';
import { RequestContextService } from '../observability/request-context.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly requestContextService: RequestContextService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const context = this.requestContextService.getContext();
    const requestId = context?.requestId ?? '';
    const correlationId = context?.correlationId ?? '';

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();
      const rawMessage =
        typeof responseBody === 'string'
          ? responseBody
          : ((responseBody as { message?: string | string[] }).message ?? exception.message);
      message = Array.isArray(rawMessage) ? rawMessage.join(', ') : String(rawMessage);
    } else {
      status = 500;
      message = exception instanceof Error ? exception.message : 'Internal server error';
    }

    this.logger.error(
      {
        statusCode: status,
        message,
        requestId,
        correlationId,
        ...(exception instanceof Error ? { stack: exception.stack } : {}),
      },
      exception instanceof Error ? exception.message : 'Unknown error',
    );

    const body: ErrorEnvelope = {
      error: {
        code: `ERR_${status}`,
        message,
        requestId,
        correlationId,
      },
    };

    response.status(status).json(body);
  }
}
