# Stage 1: Build static export
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root monorepo files
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/web ./apps/web

# Install dependencies and build static Next.js export
RUN npm ci
RUN npm run build --workspace=@classpod/shared
RUN npm run build --workspace=@classpod/web

# Stage 2: Serve via Nginx
FROM nginx:alpine AS runner

# Install curl for container healthcheck
RUN apk add --no-cache curl

# Copy Nginx config & static HTML export
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/out /usr/share/nginx/html

EXPOSE 80 3000

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:80/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
