import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  GATEWAY_SHARED_SECRET: z.string().min(16),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('1d'),
});

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  return environmentSchema.parse(config);
}
