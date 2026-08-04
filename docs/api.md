# API

The NestJS backend is the only business decision maker.

API conventions:

- Request and correlation IDs are propagated through headers.
- Responses should use shared DTO envelopes once feature endpoints are added.
- Controllers belong inside their owning domain module.
- Validation must happen at the boundary using DTO classes or schemas.
- Business actions must produce audit records and domain events.

The scaffold only exposes a health endpoint.
