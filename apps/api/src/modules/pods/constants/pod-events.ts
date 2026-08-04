export const POD_EVENT_NAMES = {
  CREATED: 'pod.created',
  UPDATED: 'pod.updated',
  ARCHIVED: 'pod.archived',
  STUDENT_JOINED: 'pod.student.joined',
  STUDENT_LEFT: 'pod.student.left',
} as const;

export const POD_AUDIT_ACTIONS = {
  CREATE: 'pod.create',
  UPDATE: 'pod.update',
  ARCHIVE: 'pod.archive',
  JOIN: 'pod.join',
  LEAVE: 'pod.leave',
} as const;
