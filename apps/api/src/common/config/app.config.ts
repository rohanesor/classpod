export const appConfig = () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  api: {
    port: Number(process.env.API_PORT ?? 4000),
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  gateway: {
    sharedSecret: process.env.GATEWAY_SHARED_SECRET,
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim()),
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
});
