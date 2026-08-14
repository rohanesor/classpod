/**
 * LocationService
 * High-accuracy device GPS acquisition abstraction for attendance verification.
 * 
 * SECURITY MANDATE:
 * - Coordinates are only requested during active attendance verification.
 * - Raw coordinates are sent directly to backend for point-in-polygon verification.
 * - Raw coordinates are NEVER displayed in the student user interface.
 */

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export class LocationService {
  /**
   * Acquires the device's current GPS location with high accuracy.
   */
  static async getCurrentLocation(timeoutMs: number = 10000): Promise<LocationResult> {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      throw new Error('Geolocation is not supported by your browser or device.');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        },
        (error) => {
          let message = 'Unable to retrieve your location.';
          if (error.code === error.PERMISSION_DENIED) {
            message = 'Location permission was denied. Please allow location access to verify attendance.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            message = 'GPS location is currently unavailable. Please ensure location services are turned on.';
          } else if (error.code === error.TIMEOUT) {
            message = 'GPS location acquisition timed out. Please try again.';
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0,
        },
      );
    });
  }
}
