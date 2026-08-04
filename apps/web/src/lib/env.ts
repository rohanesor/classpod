import { z } from 'zod';

const clientEnvironmentSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url(),
});

export const clientEnv = clientEnvironmentSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
});
