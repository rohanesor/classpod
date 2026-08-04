# Database

PostgreSQL is the primary database and Prisma is the application data-access layer.

Current schema is intentionally minimal:

- `User`: identity anchor for future auth work.
- `AuditLog`: append-only business action trace.
- `EventLog`: append-only system/domain event trace.

Feature work must add schema changes through Prisma migrations and define indexing, ownership, and retention expectations before implementation.
