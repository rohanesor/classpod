# Events

Events are first-class API concerns and should be named before feature implementation.

Initial naming convention:

- `domain.entity.action`
- Lowercase words separated by dots.
- Payloads must include request and correlation context where available.

Reserved event families:

- `attendance.*`
- `gateway.*`
- `pod.*`
- `notification.*`
- `audit.*`

No business event handlers are implemented in the bootstrap.
