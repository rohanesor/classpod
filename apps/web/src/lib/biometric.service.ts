/**
 * BiometricService
 * Production-oriented OS-level Biometric Authentication abstraction.
 * 
 * SECURITY MANDATE:
 * - Uses native Android/iOS/Desktop OS biometric authentication locally.
 * - Never collects, uploads, stores, or processes raw fingerprint images, templates, or biometric datasets on backend.
 * - Only returns a local success/failure result bound to the user session.
 */

export interface BiometricAuthResult {
  success: boolean;
  method?: 'fingerprint' | 'face' | 'device_credential';
  error?: string;
}

export class BiometricService {
  /**
   * Checks if native platform authenticator (Touch ID / Face ID / Android Biometrics / Windows Hello) is available.
   */
  static async isAvailable(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }

    // Check WebAuthn platform authenticator support
    if (
      window.PublicKeyCredential &&
      typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
    ) {
      try {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return available;
      } catch (err) {
        console.warn('Error checking biometric availability:', err);
        return false;
      }
    }

    return false;
  }

  /**
   * Triggers local OS-level biometric authentication (Fingerprint / Face ID / Device Passcode).
   * 
   * @param reason User-facing reason displayed in the biometric prompt dialog.
   */
  static async authenticate(_reason: string = 'Verify your identity for attendance'): Promise<BiometricAuthResult> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Window context unavailable' };
    }

    // 1. If WebAuthn Platform Authenticator is available, trigger native OS prompt locally
    if (window.PublicKeyCredential && navigator.credentials) {
      try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const currentHost = window.location.hostname;
        const isIpAddress = /^[0-9.]+$/.test(currentHost);
        const rpId = isIpAddress ? undefined : (currentHost || undefined);

        // Request local OS verification with platform authenticator
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 60000,
            userVerification: 'required',
            ...(rpId ? { rpId } : {}),
          },
        });

        if (credential) {
          return {
            success: true,
            method: 'fingerprint',
          };
        }
      } catch (err: any) {
        // User cancelled, timeout, or local failure
        console.warn('Native biometric prompt result:', err);
        
        // If not allowed / cancelled by user
        if (err.name === 'NotAllowedError') {
          return {
            success: false,
            error: 'Biometric authentication was cancelled or rejected by user.',
          };
        }

        // If WebAuthn credentials not yet initialized on domain, try creation challenge for local touch
        try {
          const randChallenge = new Uint8Array(32);
          window.crypto.getRandomValues(randChallenge);
          const userId = new Uint8Array(16);
          window.crypto.getRandomValues(userId);

          const currentHost = window.location.hostname;
          const isIpAddress = /^[0-9.]+$/.test(currentHost);
          const rpId = isIpAddress ? undefined : (currentHost || undefined);

          const newCred = await navigator.credentials.create({
            publicKey: {
              challenge: randChallenge,
              rp: {
                name: 'ClassPod Attendance Verification',
                ...(rpId ? { id: rpId } : {}),
              },
              user: {
                id: userId,
                name: 'classpod_student',
                displayName: 'ClassPod Student',
              },
              pubKeyCredParams: [
                { alg: -7, type: 'public-key' },
                { alg: -257, type: 'public-key' },
              ],
              authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
              },
              timeout: 60000,
            },
          });

          if (newCred) {
            return {
              success: true,
              method: 'fingerprint',
            };
          }
        } catch (createErr: any) {
          if (createErr.name === 'NotAllowedError') {
            return {
              success: false,
              error: 'Biometric authentication was cancelled by user.',
            };
          }
          return {
            success: false,
            error: createErr.message || 'Biometric authentication failed.',
          };
        }
      }
    }

    // Fallback: If device has no hardware biometric module (e.g. standard desktop browser without Hello/TouchID),
    // return success: false with clear reason
    return {
      success: false,
      error: 'No biometric authenticator available on this device.',
    };
  }
}
