/**
 * Cryptographic Installation UUID helper for ClassPod Android application.
 * Persists a unique UUID per app installation.
 */
export function getInstallationUuid(): string {
  if (typeof window === 'undefined') {
    return 'server-side-uuid-placeholder';
  }

  const STORAGE_KEY = 'classpod_installation_uuid';
  let uuid = localStorage.getItem(STORAGE_KEY);

  if (!uuid) {
    uuid = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, uuid);
  }

  return uuid;
}
