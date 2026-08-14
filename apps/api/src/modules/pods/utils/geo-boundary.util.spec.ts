import { isPointInsideClassroom, validateGeoBoundary, GeoPoint } from './geo-boundary.util';

describe('Geospatial Point-in-Polygon & Boundary Validation', () => {
  // Define an 8-point octagon polygon centered around Bangalore (12.9716, 77.5946)
  const classroomCenter: GeoPoint = { lat: 12.9716, lng: 77.5946 };
  const rLat = 0.00015;
  const rLng = 0.00015 / Math.cos((classroomCenter.lat * Math.PI) / 180);

  const valid8PointClassroom: GeoPoint[] = Array.from({ length: 8 }).map((_, i) => {
    const angle = (i * 2 * Math.PI) / 8;
    return {
      lat: +(classroomCenter.lat + rLat * Math.sin(angle)).toFixed(7),
      lng: +(classroomCenter.lng + rLng * Math.cos(angle)).toFixed(7),
    };
  });

  describe('isPointInsideClassroom', () => {
    it('returns true for a point strictly inside the classroom polygon', () => {
      // The center of the classroom should be inside
      const inside = isPointInsideClassroom(classroomCenter.lat, classroomCenter.lng, valid8PointClassroom);
      expect(inside).toBe(true);
    });

    it('returns false for a point strictly outside the classroom polygon', () => {
      // A point 500 meters away
      const outside = isPointInsideClassroom(classroomCenter.lat + 0.005, classroomCenter.lng + 0.005, valid8PointClassroom);
      expect(outside).toBe(false);
    });

    it('returns true for a point on a polygon vertex', () => {
      const vertex = valid8PointClassroom[0];
      const onVertex = isPointInsideClassroom(vertex.lat, vertex.lng, valid8PointClassroom);
      expect(onVertex).toBe(true);
    });

    it('returns true for a point on a polygon edge segment', () => {
      const p1 = valid8PointClassroom[0];
      const p2 = valid8PointClassroom[1];
      const midpoint = {
        lat: (p1.lat + p2.lat) / 2,
        lng: (p1.lng + p2.lng) / 2,
      };
      const onEdge = isPointInsideClassroom(midpoint.lat, midpoint.lng, valid8PointClassroom);
      expect(onEdge).toBe(true);
    });

    it('returns false if boundary is null, undefined, or empty', () => {
      expect(isPointInsideClassroom(12.9716, 77.5946, null)).toBe(false);
      expect(isPointInsideClassroom(12.9716, 77.5946, undefined)).toBe(false);
      expect(isPointInsideClassroom(12.9716, 77.5946, [])).toBe(false);
      expect(isPointInsideClassroom(12.9716, 77.5946, [{ lat: 1, lng: 1 }])).toBe(false);
    });
  });

  describe('validateGeoBoundary', () => {
    it('validates a correct 8-point polygon boundary', () => {
      const result = validateGeoBoundary(valid8PointClassroom);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('allows null/undefined optional boundary', () => {
      expect(validateGeoBoundary(null).valid).toBe(true);
      expect(validateGeoBoundary(undefined).valid).toBe(true);
    });

    it('rejects boundaries with fewer or more than 8 points', () => {
      const fourPoints = valid8PointClassroom.slice(0, 4);
      expect(validateGeoBoundary(fourPoints).valid).toBe(false);
      expect(validateGeoBoundary(fourPoints).error).toContain('exactly 8 coordinate vertices');

      const ninePoints = [...valid8PointClassroom, { lat: 12.98, lng: 77.6 }];
      expect(validateGeoBoundary(ninePoints).valid).toBe(false);
    });

    it('rejects points with latitude out of [-90, 90] range', () => {
      const invalid = [...valid8PointClassroom];
      invalid[0] = { lat: 95.0, lng: 77.5946 };
      const res = validateGeoBoundary(invalid);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('between -90 and 90');
    });

    it('rejects points with longitude out of [-180, 180] range', () => {
      const invalid = [...valid8PointClassroom];
      invalid[1] = { lat: 12.9716, lng: 195.0 };
      const res = validateGeoBoundary(invalid);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('between -180 and 180');
    });

    it('rejects non-numeric coordinates', () => {
      const invalid = [...valid8PointClassroom];
      invalid[2] = { lat: NaN, lng: 77.5946 };
      expect(validateGeoBoundary(invalid).valid).toBe(false);
    });

    it('rejects consecutive duplicate points', () => {
      const duplicate = [...valid8PointClassroom];
      duplicate[1] = { ...duplicate[0] };
      const res = validateGeoBoundary(duplicate);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('duplicate identical coordinates');
    });

    it('rejects degenerate/collapsed polygon geometries with zero area', () => {
      const collapsed: GeoPoint[] = Array.from({ length: 8 }).map((_, i) => ({
        lat: 12.0 + i * 0.001,
        lng: 77.0, // all points on a single straight line
      }));
      const res = validateGeoBoundary(collapsed);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('zero-area');
    });
  });
});
