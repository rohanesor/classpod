# Architecture

ClassPod is organized as a monorepo with application boundaries under `apps/` and reusable code under `packages/`.

Applications:

- `apps/web`: Next.js App Router application for teachers, students, and developer console surfaces.
- `apps/api`: NestJS backend. All business decisions, authorization, persistence, queues, and auditability belong here.
- `apps/gateway`: ESP32 firmware scaffold. The device emits observations; it never decides attendance.

Packages:

- `packages/shared`: Cross-application DTOs, enums, constants, and small utilities.
- `packages/typescript-config`: Shared TypeScript compiler presets.
- `packages/eslint-config`: Shared lint presets.

Backend domains:

- `auth`: identity and access control boundary.
- `pods`: class/subject membership boundary.
- `attendance`: attendance session and decision boundary.
- `gateway`: classroom node registration, telemetry, and observation ingestion boundary.
- `notification`: outbound notification boundary.
- `dashboard`: read-model boundary for user-facing summaries.
- `analytics`: aggregate reporting boundary.
- `logs`: audit, request, event, and error log access boundary.
- `health`: readiness and liveness boundary.

Infrastructure domains:

- `common/config`: environment loading and validation.
- `common/database`: Prisma and PostgreSQL access.
- `common/queues`: Redis/BullMQ wiring.
- `common/observability`: request IDs, correlation IDs, audit logs, event logs, error logs, metrics hooks, and structured logging.
