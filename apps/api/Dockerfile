# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root monorepo files
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api

# Install dependencies and build shared packages & NestJS API
RUN npm ci
RUN npm run build --workspace=@classpod/shared
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace=@classpod/api

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install curl and openssl for healthcheck & Prisma engine compatibility
RUN apk add --no-cache curl openssl

# Copy package manifests & node_modules from builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "dist/main.js"]
