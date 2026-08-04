import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcryptjs from 'bcryptjs';
import { PrismaService } from '../../../common/database/prisma.service';
import { EventLoggerService } from '../../../common/observability/event-logger.service';
import { LoginRateLimiterService } from './login-rate-limiter.service';
import { LoginDto } from '../dtos/login.dto';
import { RegisterDto } from '../dtos/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventLogger: EventLoggerService,
    private readonly rateLimiter: LoginRateLimiterService,
  ) {}

  async register(dto: RegisterDto, ip: string, userAgent: string) {
    // 1. Verify email uniqueness
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email address already registered');
    }

    // 2. Hash password
    const passwordHash = bcryptjs.hashSync(dto.password, 10);

    // 3. Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
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
    // 1. Check rate limits
    await this.rateLimiter.checkLimit(ip);

    // 2. Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
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
}
