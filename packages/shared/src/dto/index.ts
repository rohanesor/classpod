export interface ApiEnvelope<TData> {
  data: TData;
  meta: {
    requestId: string;
    correlationId: string;
  };
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    correlationId: string;
  };
}

export interface PageRequestDto {
  cursor?: string;
  limit?: number;
}

export interface PageResponseDto<TItem> {
  items: TItem[];
  nextCursor?: string;
}
