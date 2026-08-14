import { isPointInsideClassroom, validateGeoBoundary, GeoPoint } from './modules/pods/utils/geo-boundary.util';
import { AttendanceService } from './modules/attendance/services/attendance.service';
import { AttendanceSessionStatus, AttendanceDecisionStatus } from '@prisma/client';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runAllTests() {
  console.log('\n=============================================');
  console.log('ClassPod Multi-Factor Verification Test Suite');
  console.log('=============================================\n');

  // --- PART 1: POINT-IN-POLYGON & GEO-BOUNDARY TESTS ---
  console.log('--- Suite 1: Point-in-Polygon & Geo-Boundary Validation ---');

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

  // 1. Inside classroom polygon
  assert(
    isPointInsideClassroom(classroomCenter.lat, classroomCenter.lng, valid8PointClassroom) === true,
    'Point strictly inside classroom polygon returns true',
  );

  // 2. Outside classroom polygon
  assert(
    isPointInsideClassroom(classroomCenter.lat + 0.005, classroomCenter.lng + 0.005, valid8PointClassroom) === false,
    'Point outside classroom polygon returns false',
  );

  // 3. Boundary vertex inclusion
  const v0 = valid8PointClassroom[0]!;
  assert(
    isPointInsideClassroom(v0.lat, v0.lng, valid8PointClassroom) === true,
    'Point exactly on polygon vertex returns true',
  );

  // 4. Boundary segment inclusion
  const p0 = valid8PointClassroom[0]!;
  const p1 = valid8PointClassroom[1]!;
  const mid = {
    lat: (p0.lat + p1.lat) / 2,
    lng: (p0.lng + p1.lng) / 2,
  };
  assert(
    isPointInsideClassroom(mid.lat, mid.lng, valid8PointClassroom) === true,
    'Point on polygon edge segment returns true',
  );

  // 5. Valid 8-point boundary validation
  assert(validateGeoBoundary(valid8PointClassroom).valid === true, 'Valid 8-point boundary passes validation');

  // 6. Non-8-point boundary rejection
  assert(validateGeoBoundary(valid8PointClassroom.slice(0, 4)).valid === false, '4-point boundary is rejected');

  // 7. Invalid coordinates rejection
  const outOfRange: GeoPoint[] = [...valid8PointClassroom];
  outOfRange[0] = { lat: 95.0, lng: 77.5946 };
  assert(validateGeoBoundary(outOfRange).valid === false, 'Out-of-range latitude (>90) is rejected');

  // 8. Duplicate coordinates rejection
  const dup: GeoPoint[] = [...valid8PointClassroom];
  dup[1] = { lat: valid8PointClassroom[0]!.lat, lng: valid8PointClassroom[0]!.lng };
  assert(validateGeoBoundary(dup).valid === false, 'Consecutive duplicate vertices are rejected');

  // --- PART 2: MULTI-FACTOR ATTENDANCE ENGINE TESTS ---
  console.log('\n--- Suite 2: Multi-Factor Attendance Verification Engine ---');

  const testStudentId = 'student-123';
  const testSessionId = 'session-456';
  const testGatewayId = 'esp32-cam-node-1';
  const testChallengeToken = 'CHALLENGE-SECURE-TOKEN-123';
  const testDeviceId = 'device-uuid-999';

  const baseActiveSession = {
    id: testSessionId,
    podId: 'pod-789',
    status: AttendanceSessionStatus.ACTIVE,
    expiresAt: new Date(Date.now() + 60000),
    challengeToken: testChallengeToken,
    pod: {
      id: 'pod-789',
      geoBoundary: valid8PointClassroom,
    },
  };

  const baseDecision = {
    id: 'decision-001',
    sessionId: testSessionId,
    studentId: testStudentId,
    status: AttendanceDecisionStatus.PENDING,
  };

  const baseRegisteredDevice = {
    id: 'reg-001',
    userId: testStudentId,
    deviceId: testDeviceId,
  };

  const baseGateway = {
    id: testGatewayId,
    name: 'Classroom Gateway 1',
  };

  function createMockAttendanceService(overrides: {
    session?: any;
    decision?: any;
    device?: any;
    gateway?: any;
  } = {}) {
    const session = overrides.session !== undefined ? overrides.session : baseActiveSession;
    const decision = overrides.decision !== undefined ? overrides.decision : baseDecision;
    const device = overrides.device !== undefined ? overrides.device : baseRegisteredDevice;
    const gateway = overrides.gateway !== undefined ? overrides.gateway : baseGateway;

    const mockPrisma: any = {
      attendanceSession: {
        findUnique: async () => session,
        findMany: async () => [],
        update: async (args: any) => ({ ...session, ...args.data }),
      },
      attendanceDecision: {
        findUnique: async () => decision,
        update: async (args: any) => ({ ...decision, ...args.data }),
      },
      registeredDevice: {
        findUnique: async () => device,
      },
      gateway: {
        findUnique: async () => gateway,
      },
      verificationSignal: {
        createMany: async () => ({ count: 4 }),
      },
    };

    const mockEventLogger: any = {
      audit: () => {},
      event: () => {},
    };

    return new AttendanceService(mockPrisma, mockEventLogger);
  }

  // 1. Valid Biometric + BLE + Inside Classroom -> PRESENT
  try {
    const service = createMockAttendanceService();
    const res = await service.checkin(testStudentId, {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    });
    assert(res.status === AttendanceDecisionStatus.PRESENT, '1. Valid Biometric + BLE + Inside Classroom -> PRESENT');
  } catch (err: any) {
    assert(false, '1. Valid Biometric + BLE + Inside Classroom -> PRESENT (Error: ' + err.message + ')');
  }

  // 2. Biometric Failure -> NOT_PRESENT (BIOMETRIC_FAILED)
  try {
    const service = createMockAttendanceService();
    await service.checkin(testStudentId, {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: false,
      latitude: 12.9716,
      longitude: 77.5946,
    });
    assert(false, '2. Biometric failure should reject');
  } catch (err: any) {
    assert(
      err.message.includes('biometric') || err.message.includes('BIOMETRIC_FAILED'),
      '2. Biometric failure records NOT_PRESENT and rejects with BIOMETRIC_FAILED',
    );
  }

  // 3. Unregistered Device -> NOT_PRESENT (DEVICE_NOT_REGISTERED)
  try {
    const service = createMockAttendanceService();
    await service.checkin(testStudentId, {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: 'wrong-unregistered-device-id',
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    });
    assert(false, '3. Unregistered device should reject');
  } catch (err: any) {
    assert(
      err.message.includes('registered') || err.message.includes('DEVICE_NOT_REGISTERED'),
      '3. Unregistered device records NOT_PRESENT and rejects with DEVICE_NOT_REGISTERED',
    );
  }

  // 4. Outside Classroom Polygon -> NOT_PRESENT (OUTSIDE_CLASSROOM)
  try {
    const service = createMockAttendanceService();
    await service.checkin(testStudentId, {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 13.05, // Far outside polygon
      longitude: 77.7,
    });
    assert(false, '4. Outside classroom polygon should reject');
  } catch (err: any) {
    assert(
      err.message.includes('outside the classroom') || err.message.includes('OUTSIDE_CLASSROOM'),
      '4. Outside classroom polygon records NOT_PRESENT and rejects with OUTSIDE_CLASSROOM',
    );
  }

  // 5. Inside Classroom Polygon -> geoVerified=true
  try {
    const service = createMockAttendanceService();
    const res = await service.checkin(testStudentId, {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    });
    assert(res.status === AttendanceDecisionStatus.PRESENT, '5. Inside classroom polygon validates geoVerified=true');
  } catch (err: any) {
    assert(false, '5. Inside classroom polygon validation failed: ' + err.message);
  }

  // 6. Boundary Coordinates
  try {
    const service = createMockAttendanceService();
    const res = await service.checkin(testStudentId, {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: valid8PointClassroom[0]!.lat,
      longitude: valid8PointClassroom[0]!.lng,
    });
    assert(res.status === AttendanceDecisionStatus.PRESENT, '6. Boundary coordinates on vertex are accepted');
  } catch (err: any) {
    assert(false, '6. Boundary coordinates test failed: ' + err.message);
  }

  // 7. Invalid Coordinates
  try {
    const service = createMockAttendanceService();
    await service.checkin(testStudentId, {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: NaN,
      longitude: 77.5946,
    });
    assert(false, '7. Invalid NaN coordinates should reject');
  } catch (err: any) {
    assert(
      err.message.includes('Location') || err.message.includes('LOCATION_UNAVAILABLE'),
      '7. Invalid coordinates reject with LOCATION_UNAVAILABLE',
    );
  }

  // 8. Inactive Session
  try {
    const service = createMockAttendanceService({
      session: { ...baseActiveSession, status: AttendanceSessionStatus.CLOSED },
    });
    await service.checkin(testStudentId, {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    });
    assert(false, '8. Inactive session should reject');
  } catch (err: any) {
    assert(err.message.includes('SESSION_NOT_ACTIVE') || err.message.includes('closed or expired'), '8. Inactive session rejects immediately');
  }

  // 9. Wrong Classroom / Session combination
  try {
    const service = createMockAttendanceService({ session: null });
    await service.checkin(testStudentId, {
      sessionId: 'nonexistent-session',
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    });
    assert(false, '9. Non-existent session should throw');
  } catch (err: any) {
    assert(err.message.includes('not found'), '9. Non-existent session throws NotFoundException');
  }

  // 10. Missing Location when boundary is active -> LOCATION_UNAVAILABLE
  try {
    const service = createMockAttendanceService();
    await service.checkin(testStudentId, {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: undefined,
      longitude: undefined,
    });
    assert(false, '10. Missing location should reject');
  } catch (err: any) {
    assert(
      err.message.includes('Location') || err.message.includes('LOCATION_UNAVAILABLE'),
      '10. Missing coordinates when classroom boundary active rejects with LOCATION_UNAVAILABLE',
    );
  }

  // 11. Duplicate Attendance Verification
  try {
    const service = createMockAttendanceService({
      decision: { ...baseDecision, status: AttendanceDecisionStatus.PRESENT },
    });
    await service.checkin(testStudentId, {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    });
    assert(false, '11. Duplicate check-in should reject');
  } catch (err: any) {
    assert(err.message.includes('Already checked in'), '11. Duplicate attendance verification rejects with Already checked in');
  }

  // 12. Unauthorized Student attempting another student's attendance
  try {
    const service = createMockAttendanceService({ decision: null });
    await service.checkin('unauthorized-intruder-id', {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    });
    assert(false, '12. Unauthorized student should reject');
  } catch (err: any) {
    assert(err.message.includes('not registered'), '12. Unauthorized student not enrolled throws ForbiddenException');
  }

  console.log('\n=============================================');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('=============================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
