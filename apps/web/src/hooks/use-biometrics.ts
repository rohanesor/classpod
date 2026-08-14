import { useState, useEffect, useCallback } from 'react';
import { BiometricService, BiometricAuthResult } from '../lib/biometric.service';

export interface UseBiometricsReturn {
  isAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  checkAvailability: () => Promise<boolean>;
  authenticate: (reason?: string) => Promise<BiometricAuthResult>;
}

export function useBiometrics(): UseBiometricsReturn {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const checkAvailability = useCallback(async () => {
    try {
      const available = await BiometricService.isAvailable();
      setIsAvailable(available);
      return available;
    } catch {
      setIsAvailable(false);
      return false;
    }
  }, []);

  useEffect(() => {
    checkAvailability();
  }, [checkAvailability]);

  const authenticate = useCallback(async (reason: string = 'Verify your identity for attendance'): Promise<BiometricAuthResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await BiometricService.authenticate(reason);
      if (!result.success) {
        setError(result.error || 'Biometric authentication failed.');
      }
      return result;
    } catch (err: any) {
      const msg = err?.message || 'Biometric authentication failed.';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isAvailable,
    isLoading,
    error,
    checkAvailability,
    authenticate,
  };
}
