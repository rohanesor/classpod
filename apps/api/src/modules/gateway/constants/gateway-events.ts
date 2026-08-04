export const GATEWAY_EVENT_NAMES = {
  HEARTBEAT_RECEIVED: 'gateway.heartbeat.received',
  OBSERVATION_RECEIVED: 'gateway.observation.received',
  ONLINE: 'gateway.online',
  OFFLINE: 'gateway.offline',
} as const;

export const GATEWAY_AUDIT_ACTIONS = {
  HEARTBEAT: 'gateway.heartbeat',
  OBSERVATION_STORE: 'gateway.observation.store',
  ONLINE: 'gateway.online',
  OFFLINE: 'gateway.offline',
} as const;
