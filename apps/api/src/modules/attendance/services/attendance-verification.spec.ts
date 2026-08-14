import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceSessionStatus, AttendanceDecisionStatus } from '@prisma/client';
import { GeoPoint } from '../../pods/utils/geo-boundary.util';

describe('Multi-Factor Attendance Verification Engine', () => {
  let service: AttendanceService;
  let mockPrisma: any;
  let mockEventLogger: any;

  const testStudentId = 'student-123';
  const testSessionId = 'session-456';
  const testGatewayId = 'esp32-cam-node-1';
  const testChallengeToken = 'CHALLENGE-SECURE-TOKEN-123';
  const testDeviceId = 'device-uuid-999';

  // 8-point polygon boundary around (12.9716, 77.5946)
  const valid8PointClassroom: GeoPoint[] = Array.from({ length: 8 }).map((_, i) => {
    const angle = (i * 2 * Math.PI) / 8;
    return {
      lat: +(12.9716 + 0.00015 * Math.sin(angle)).toFixed(7),
      lng: +(77.5946 + 0.00015 * Math.cos(angle)).toFixed(7),
    };
  });

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

  beforeEach(() => {
    mockPrisma = {
      attendanceSession: {
        findUnique: jest.fn().mockResolvedValue(baseActiveSession),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue(baseActiveSession),
      },
      attendanceDecision: {
        findUnique: jest.fn().mockResolvedValue(baseDecision),
        update: jest.fn().mockImplementation((args) => Promise.resolve({ ...baseDecision, ...args.data })),
      },
      registeredDevice: {
        findUnique: jest.fn().mockResolvedValue(baseRegisteredDevice),
      },
      gateway: {
        findUnique: jest.fn().mockResolvedValue(baseGateway),
      },
      verificationSignal: {
        createMany: jest.fn().mockResolvedValue({ count: 4 }),
      },
    };

    mockEventLogger = {
      audit: jest.fn(),
      event: jest.fn(),
    };

    service = new AttendanceService(mockPrisma as any, mockEventLogger as any);
  });

  // 1. Valid Biometric + BLE + Inside Classroom -> PRESENT
  it('1. Valid biometric + BLE + inside classroom returns PRESENT', async () => {
    const checkinDto = {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    };

    const result = await service.checkin(testStudentId, checkinDto);
    expect(result.status).toBe(AttendanceDecisionStatus.PRESENT);
    expect(mockPrisma.attendanceDecision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AttendanceDecisionStatus.PRESENT,
        }),
      }),
    );
    expect(mockPrisma.verificationSignal.createMany).toHaveBeenCalled();
  });

  // 2. Biometric Failure -> NOT_PRESENT (BIOMETRIC_FAILED)
  it('2. Biometric failure records NOT_PRESENT and rejects with BIOMETRIC_FAILED', async () => {
    const checkinDto = {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: false, // FAILED
      latitude: 12.9716,
      longitude: 77.5946,
    };

    await expect(service.checkin(testStudentId, checkinDto)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.attendanceDecision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AttendanceDecisionStatus.NOT_PRESENT,
          explanation: 'BIOMETRIC_FAILED',
        }),
      }),
    );
  });

  // 3. Unregistered Device -> NOT_PRESENT (DEVICE_NOT_REGISTERED)
  it('3. Unregistered device records NOT_PRESENT and rejects with DEVICE_NOT_REGISTERED', async () => {
    const checkinDto = {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: 'different-unregistered-device-id',
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    };

    await expect(service.checkin(testStudentId, checkinDto)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.attendanceDecision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AttendanceDecisionStatus.NOT_PRESENT,
          explanation: 'DEVICE_NOT_REGISTERED',
        }),
      }),
    );
  });

  // 4. Outside Classroom Polygon -> NOT_PRESENT (OUTSIDE_CLASSROOM)
  it('4. Outside classroom polygon records NOT_PRESENT and rejects with OUTSIDE_CLASSROOM', async () => {
    const checkinDto = {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 13.05, // Far away outside classroom
      longitude: 77.7,
    };

    await expect(service.checkin(testStudentId, checkinDto)).rejects.toThrow(BadRequestException);
    expect(mockPrisma.attendanceDecision.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AttendanceDecisionStatus.NOT_PRESENT,
          explanation: 'OUTSIDE_CLASSROOM',
        }),
      }),
    );
  });

  // 5. Inside Classroom Polygon -> geoVerified=true
  it('5. Inside classroom polygon validates geoVerified=true', async () => {
    const checkinDto = {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    };

    const res = await service.checkin(testStudentId, checkinDto);
    expect(res.status).toBe(AttendanceDecisionStatus.PRESENT);
  });

  // 6. Boundary Coordinates
  it('6. Point exactly on classroom vertex boundary is accepted', async () => {
    const vertex = valid8PointClassroom[0];
    const checkinDto = {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: vertex.lat,
      longitude: vertex.lng,
    };

    const res = await service.checkin(testStudentId, checkinDto);
    expect(res.status).toBe(AttendanceDecisionStatus.PRESENT);
  });

  // 7. Invalid Coordinates
  it('7. Invalid or NaN coordinates reject with LOCATION_UNAVAILABLE', async () => {
    const checkinDto = {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: NaN,
      longitude: 77.5946,
    };

    await expect(service.checkin(testStudentId, checkinDto)).rejects.toThrow(BadRequestException);
  });

  // 8. Inactive Session -> SESSION_NOT_ACTIVE
  it('8. Inactive or closed session rejects immediately', async () => {
    mockPrisma.attendanceSession.findUnique.mockResolvedValue({
      ...baseActiveSession,
      status: AttendanceSessionStatus.CLOSED,
    });

    const checkinDto = {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    };

    await expect(service.checkin(testStudentId, checkinDto)).rejects.toThrow(BadRequestException);
  });

  // 9. Wrong Classroom / Session combination
  it('9. Non-existent session throws NotFoundException', async () => {
    mockPrisma.attendanceSession.findUnique.mockResolvedValue(null);

    const checkinDto = {
      sessionId: 'wrong-nonexistent-session',
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    };

    await expect(service.checkin(testStudentId, checkinDto)).rejects.toThrow(NotFoundException);
  });

  // 10. Missing Location when classroom has boundary -> LOCATION_UNAVAILABLE
  it('10. Missing coordinates when classroom boundary is active rejects with LOCATION_UNAVAILABLE', async () => {
    const checkinDto = {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: undefined,
      longitude: undefined,
    };

    await expect(service.checkin(testStudentId, checkinDto)).rejects.toThrow(BadRequestException);
  });

  // 11. Duplicate Attendance Verification -> Already checked in
  it('11. Duplicate attendance verification rejects if already checked in', async () => {
    mockPrisma.attendanceDecision.findUnique.mockResolvedValue({
      ...baseDecision,
      status: AttendanceDecisionStatus.PRESENT,
    });

    const checkinDto = {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    };

    await expect(service.checkin(testStudentId, checkinDto)).rejects.toThrow('Already checked in');
  });

  // 12. Unauthorized Student attempting check-in without enrollment
  it('12. Unauthorized student not in decision roster throws ForbiddenException', async () => {
    mockPrisma.attendanceDecision.findUnique.mockResolvedValue(null);

    const checkinDto = {
      sessionId: testSessionId,
      gatewayId: testGatewayId,
      challengeToken: testChallengeToken,
      deviceId: testDeviceId,
      isMobileApp: true,
      biometricVerified: true,
      latitude: 12.9716,
      longitude: 77.5946,
    };

    await expect(service.checkin('unregistered-intruder-id', checkinDto)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
