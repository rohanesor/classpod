# System Flow

Attendance flow target state:

1. Teacher starts an attendance session in a Pod.
2. Student submits attendance confirmation from a client.
3. Gateway reports classroom presence observations.
4. Backend correlates client confirmation, session state, policy, and gateway observations.
5. Backend records the attendance decision and audit trail.
6. Dashboards and notifications consume backend-owned state.

The gateway never decides the outcome at any step.
