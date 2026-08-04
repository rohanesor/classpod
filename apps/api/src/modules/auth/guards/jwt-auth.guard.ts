import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../../common/database/prisma.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    let token: string | null = null;

    // 1. Check Authorization Bearer header first (Mobile App & API Clients)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 2. Fall back to classpod_token cookie (Web Browser)
    if (!token && request.headers.cookie) {
      const match = request.headers.cookie.match(/(?:^|;)\s*classpod_token\s*=\s*([^;]+)/);
      if (match) {
        token = match[1];
      }
    }

    if (!token) {
      throw new UnauthorizedException('Authentication token missing');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token);

      if (!payload || !payload.sub) {
        throw new UnauthorizedException('Invalid token structure');
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('User is inactive');
      }

      request.user = user;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }
}
