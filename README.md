# ClassPod

Production monorepo scaffold for ClassPod, an intelligent classroom platform.

## Structure

- `apps/web`: Next.js App Router frontend.
- `apps/api`: NestJS backend.
- `apps/gateway`: ESP32 gateway firmware scaffold.
- `packages/shared`: Shared DTOs, enums, constants, and utilities.
- `packages/typescript-config`: Shared TypeScript presets.
- `packages/eslint-config`: Shared ESLint presets.
- `infra/docker`: Application Dockerfiles.
- `docs`: Architecture and operating rules.

## Development

1. Copy `.env.example` to `.env` and application examples as needed.
2. Start dependencies with `npm run docker:up`.
3. Install dependencies with `npm install`.
4. Generate Prisma Client with `npm run db:generate`.
5. Run all apps with `npm run dev`.

## Guardrails

The backend owns all business decisions. Gateway firmware only reports observations and diagnostics.
