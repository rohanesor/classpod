import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CORRELATION_ID_HEADER, REQUEST_ID_HEADER } from '@classpod/shared';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextService } from './request-context.service';

@Injectable()
export class RequestContextMiddleware {
  constructor(private readonly requestContextService: RequestContextService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const requestId = getHeader(request, REQUEST_ID_HEADER) ?? randomUUID();
    const correlationId = getHeader(request, CORRELATION_ID_HEADER) ?? requestId;

    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    this.requestContextService.run({ requestId, correlationId }, () => {
      next();
    });
  }
}

function getHeader(request: Request, headerName: string): string | undefined {
  const value = request.headers[headerName];
  return Array.isArray(value) ? value[0] : value;
}
