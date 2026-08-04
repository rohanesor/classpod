# Engineering Rules

1. The backend is the source of truth for business decisions.
2. Gateway firmware never marks attendance as valid, present, absent, late, or rejected.
3. Shared code must remain transport-safe: DTOs, enums, constants, and pure utilities only.
4. Domain modules must not reach across boundaries by importing another domain's internals.
5. Every request must carry or receive a request ID and correlation ID.
6. Audit logs are required for actor-driven business actions.
7. Event logs are required for meaningful domain and integration events.
8. Environment variables must be validated at application startup.
9. Business behavior must not be added during scaffold-only work.
10. New features must declare ownership, persistence changes, events, and observability before implementation.
