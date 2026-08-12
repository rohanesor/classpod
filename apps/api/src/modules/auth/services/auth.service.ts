import { Injectable, UnauthorizedException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcryptjs from 'bcryptjs';
import { PrismaService } from '../../../common/database/prisma.service';
import { EventLoggerService } from '../../../common/observability/event-logger.service';
import { LoginRateLimiterService } from './login-rate-limiter.service';
import { LoginDto } from '../dtos/login.dto';
import { RegisterDto } from '../dtos/register.dto';
import { RegisterDeviceDto } from '../dtos/register-device.dto';
import { AttendanceSessionStatus, AttendanceDecisionStatus } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventLogger: EventLoggerService,
    private readonly rateLimiter: LoginRateLimiterService,
  ) {}

  async register(dto: RegisterDto, ip: string, userAgent: string) {
    const normalizedEmail = (dto?.email || '').trim().toLowerCase();

    // 1. Verify email uniqueness
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('Email address already registered');
    }

    // 2. Hash password
    const passwordHash = bcryptjs.hashSync(dto.password, 10);

    // 3. Create user
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: dto.name,
        role: dto.role,
        heardFrom: dto.heardFrom,
        onboardingReason: dto.onboardingReason,
        isActive: true,
      },
    });

    // 4. Generate JWT token
    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // 5. Write events & audit
    this.eventLogger.audit('auth.register.success', {
      actorUserId: user.id,
      entityType: 'User',
      entityId: user.id,
      ip,
      userAgent,
    });

    this.eventLogger.event('auth.user.registered', {
      userId: user.id,
      role: user.role,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    });

    // 6. Return user profile and token
    const userProfile = { ...user };
    delete (userProfile as any).passwordHash;

    return {
      user: userProfile,
      token,
    };
  }

  async login(dto: LoginDto, ip: string, userAgent: string) {
    const normalizedEmail = (dto?.email || '').trim().toLowerCase();

    // 1. Check rate limits
    await this.rateLimiter.checkLimit(ip);

    // 2. Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // 3. Verify password
    const isPasswordValid = user ? bcryptjs.compareSync(dto.password, user.passwordHash) : false;

    if (!user || !isPasswordValid) {
      // Record failed attempt audit log and event
      this.eventLogger.audit('auth.login.failed', {
        actorUserId: null,
        entityType: 'User',
        entityId: null,
        email: dto.email,
        ip,
        userAgent,
      });

      this.eventLogger.event('auth.user.login_failed', {
        email: dto.email,
        ip,
        userAgent,
      });

      // Increment rate limit counter
      await this.rateLimiter.increment(ip);

      throw new UnauthorizedException('Invalid email or password');
    }

    // 4. Check if active
    if (!user.isActive) {
      this.eventLogger.audit('auth.login.inactive', {
        actorUserId: user.id,
        entityType: 'User',
        entityId: user.id,
        ip,
        userAgent,
      });

      throw new UnauthorizedException('User account is inactive');
    }

    // 5. Generate JWT token
    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // 6. Write success audit log and event
    this.eventLogger.audit('auth.login.success', {
      actorUserId: user.id,
      entityType: 'User',
      entityId: user.id,
      ip,
      userAgent,
    });

    this.eventLogger.event('auth.user.logged_in', {
      userId: user.id,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
    });

    // 7. Return profile and token
    const userProfile = { ...user };
    delete (userProfile as any).passwordHash;

    return {
      user: userProfile,
      token,
    };
  }

  async logout(userId: string): Promise<void> {
    // Check if student has an active attendance session/decision
    const activeDecision = await this.prisma.attendanceDecision.findFirst({
      where: {
        studentId: userId,
        status: {
          in: [AttendanceDecisionStatus.PENDING, AttendanceDecisionStatus.CHECKED_IN],
        },
        session: {
          status: AttendanceSessionStatus.ACTIVE,
        },
      },
    });

    if (activeDecision) {
      throw new ForbiddenException('Logout is disabled while attendance is in progress.');
    }

    this.eventLogger.audit('auth.logout.success', {
      actorUserId: userId,
      entityType: 'User',
      entityId: userId,
    });

    this.eventLogger.event('auth.user.logged_out', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  // Bind installation UUID to user
  async registerDevice(userId: string, dto: RegisterDeviceDto, userAgent?: string) {
    const existingDevice = await this.prisma.registeredDevice.findUnique({
      where: { userId },
    });

    if (existingDevice) {
      if (existingDevice.deviceId === dto.deviceId) {
        return {
          registered: true,
          message: 'Device already registered for this account',
          device: existingDevice,
        };
      }
      throw new BadRequestException('Device not registered for this account.');
    }

    const newDevice = await this.prisma.registeredDevice.create({
      data: {
        userId,
        deviceId: dto.deviceId,
        platform: dto.platform || 'android',
        userAgent,
      },
    });

    this.eventLogger.audit('auth.device.registered', {
      actorUserId: userId,
      entityType: 'RegisteredDevice',
      entityId: newDevice.id,
      deviceId: dto.deviceId,
    });

    return {
      registered: true,
      message: 'Device registered successfully',
      device: newDevice,
    };
  }

  async getRegisteredDevice(userId: string) {
    return this.prisma.registeredDevice.findUnique({
      where: { userId },
    });
  }

  async adminResetDevice(userId: string) {
    const existing = await this.prisma.registeredDevice.findUnique({
      where: { userId },
    });

    if (!existing) {
      return { message: 'No device bound to this account' };
    }

    await this.prisma.registeredDevice.delete({
      where: { userId },
    });

    return { message: `Device un-bound successfully for user ${userId}` };
  }

  async updateProfile(userId: string, data: { name?: string; phone?: string }) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      },
    });

    const profile = { ...updated };
    delete (profile as any).passwordHash;
    return profile;
  }
}
