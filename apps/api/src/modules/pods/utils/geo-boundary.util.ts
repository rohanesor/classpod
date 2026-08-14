export interface GeoPoint {
  lat: number;
  lng: number;
}

const EPSILON = 1e-7;

/**
 * Checks if a point lies on a line segment between p1 and p2.
 */
function isPointOnSegment(p: GeoPoint, p1: GeoPoint, p2: GeoPoint): boolean {
  const crossProduct = (p.lat - p1.lat) * (p2.lng - p1.lng) - (p.lng - p1.lng) * (p2.lat - p1.lat);
  if (Math.abs(crossProduct) > EPSILON) {
    return false;
  }

  const dotProduct = (p.lng - p1.lng) * (p2.lng - p1.lng) + (p.lat - p1.lat) * (p2.lat - p1.lat);
  if (dotProduct < -EPSILON) {
    return false;
  }

  const squaredLength = (p2.lng - p1.lng) * (p2.lng - p1.lng) + (p2.lat - p1.lat) * (p2.lat - p1.lat);
  if (dotProduct > squaredLength + EPSILON) {
    return false;
  }

  return true;
}

/**
 * Reusable Point-in-Polygon (Ray-Casting algorithm) to test if a given GPS coordinate
 * is physically inside the classroom boundary polygon.
 */
export function isPointInsideClassroom(
  latitude: number,
  longitude: number,
  classroomBoundary: GeoPoint[] | null | undefined,
): boolean {
  if (!classroomBoundary || !Array.isArray(classroomBoundary) || classroomBoundary.length < 3) {
    return false;
  }

  const p: GeoPoint = { lat: latitude, lng: longitude };
  const n = classroomBoundary.length;

  // 1. Boundary & Vertex Inclusion Check
  for (let i = 0; i < n; i++) {
    const p1 = classroomBoundary[i];
    const p2 = classroomBoundary[(i + 1) % n];

    if (!p1 || !p2) continue;

    // Check exact vertex match
    if (Math.abs(p.lat - p1.lat) < EPSILON && Math.abs(p.lng - p1.lng) < EPSILON) {
      return true;
    }

    // Check segment boundary
    if (isPointOnSegment(p, p1, p2)) {
      return true;
    }
  }

  // 2. Ray-Casting Algorithm (Even-Odd rule)
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const pi = classroomBoundary[i];
    const pj = classroomBoundary[j];

    if (!pi || !pj) continue;

    const xi = pi.lng, yi = pi.lat;
    const xj = pj.lng, yj = pj.lat;

    const intersect = yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Validates a classroom geospatial boundary (must contain exactly 8 valid vertex pairs).
 */
export function validateGeoBoundary(boundary: any): { valid: boolean; error?: string } {
  if (!boundary) {
    return { valid: true }; // Optional boundary
  }

  if (!Array.isArray(boundary)) {
    return { valid: false, error: 'Classroom geo-boundary must be an array of coordinates.' };
  }

  if (boundary.length !== 8) {
    return {
      valid: false,
      error: `Classroom geo-boundary must contain exactly 8 coordinate vertices (found ${boundary.length}).`,
    };
  }

  for (let i = 0; i < boundary.length; i++) {
    const pt = boundary[i];
    if (
      !pt ||
      typeof pt.lat !== 'number' ||
      typeof pt.lng !== 'number' ||
      isNaN(pt.lat) ||
      isNaN(pt.lng)
    ) {
      return {
        valid: false,
        error: `Point ${i + 1} has invalid latitude or longitude numbers.`,
      };
    }

    if (pt.lat < -90 || pt.lat > 90) {
      return {
        valid: false,
        error: `Point ${i + 1} latitude (${pt.lat}) must be between -90 and 90 degrees.`,
      };
    }

    if (pt.lng < -180 || pt.lng > 180) {
      return {
        valid: false,
        error: `Point ${i + 1} longitude (${pt.lng}) must be between -180 and 180 degrees.`,
      };
    }
  }

  // Check for consecutive duplicate points
  for (let i = 0; i < boundary.length; i++) {
    const current = boundary[i];
    const next = boundary[(i + 1) % boundary.length];
    if (Math.abs(current.lat - next.lat) < EPSILON && Math.abs(current.lng - next.lng) < EPSILON) {
      return {
        valid: false,
        error: `Points ${i + 1} and ${((i + 1) % boundary.length) + 1} are duplicate identical coordinates.`,
      };
    }
  }

  // Calculate polygon area (Shoelace formula) to ensure non-degenerate geometry
  let area = 0;
  for (let i = 0; i < boundary.length; i++) {
    const j = (i + 1) % boundary.length;
    area += boundary[i].lng * boundary[j].lat;
    area -= boundary[j].lng * boundary[i].lat;
  }
  area = Math.abs(area) / 2;

  if (area < 1e-12) {
    return {
      valid: false,
      error: 'Polygon vertices form a collapsed line or zero-area geometry.',
    };
  }

  return { valid: true };
}
