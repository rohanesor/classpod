import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiEnvelope } from '@classpod/shared';
import { RequestContextService } from '../observability/request-context.service';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiEnvelope<T> | T> {
  constructor(private readonly requestContextService: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // Leave StreamableFiles, buffers, or undefined unchanged
        if (data instanceof StreamableFile || data === undefined) {
          return data;
        }

        // If data is already an envelope with data & meta, pass through
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return data;
        }

        const ctx = this.requestContextService.getContext();
        return {
          data,
          meta: {
            requestId: ctx?.requestId ?? '',
            correlationId: ctx?.correlationId ?? '',
          },
        };
      })
    );
  }
}
