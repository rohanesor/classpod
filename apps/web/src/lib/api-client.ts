import type { ApiEnvelope, ErrorEnvelope } from '@classpod/shared';
import { Capacitor } from '@capacitor/core';

class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly errorBody: ErrorEnvelope['error'],
  ) {
    super(errorBody.message);
    this.name = 'ApiError';
  }
}

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    if (Capacitor.isNativePlatform()) {
      return 'http://3.107.200.248/api';
    }
    const port = window.location.port;
    if (port === '80' || port === '' || port === '443') {
      return '/api';
    }
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return `${window.location.protocol}//${hostname}${port ? `:${port}` : ''}/api`;
    }
  }
  return 'http://3.107.200.248/api';
}

async function request<T>(method: string, path: string, body?: unknown): Promise<ApiEnvelope<T>> {
  const url = `${getApiBaseUrl()}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Attach Authorization Bearer token if present in localStorage (Mobile native & Web)
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('classpod_auth_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorBody: ErrorEnvelope['error'];
    try {
      const json = await response.json();
      errorBody = json.error || {
        code: `HTTP_${response.status}`,
        message: json.message || response.statusText || 'API Request Failed',
        requestId: '',
        correlationId: '',
      };
    } catch {
      errorBody = {
        code: `HTTP_${response.status}`,
        message: `Request failed with status ${response.status}: ${response.statusText}`,
        requestId: '',
        correlationId: '',
      };
    }
    throw new ApiError(response.status, errorBody);
  }

  return (await response.json()) as ApiEnvelope<T>;
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export { ApiError };
