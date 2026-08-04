import { Controller, Post, Body, Get, Req, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dtos/login.dto';
import { RegisterDto } from '../dtos/register.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';
import { RequestContextService } from '../../../common/observability/request-context.service';
import { ApiEnvelope } from '@classpod/shared';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly requestContextService: RequestContextService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiEnvelope<any>> {
    const ip = request.ip || request.socket.remoteAddress || '';
    const userAgent = request.headers['user-agent'] || '';

    const { user, token } = await this.authService.register(dto, ip, userAgent);

    const isProduction = this.configService.get<string>('nodeEnv') === 'production';

    // Set the JWT token in an HTTP-only, SameSite=Lax, Secure cookie
    response.cookie('classpod_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      // 1 day expiration
      maxAge: 24 * 60 * 60 * 1000,
    });

    const context = this.requestContextService.getContext();

    return {
      data: { user, token },
      meta: {
        requestId: context?.requestId ?? '',
        correlationId: context?.correlationId ?? '',
      },
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiEnvelope<any>> {
    const ip = request.ip || request.socket.remoteAddress || '';
    const userAgent = request.headers['user-agent'] || '';

    const { user, token } = await this.authService.login(dto, ip, userAgent);

    const isProduction = this.configService.get<string>('nodeEnv') === 'production';

    // Set the JWT token in an HTTP-only, SameSite=Lax, Secure cookie
    response.cookie('classpod_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      // 1 day expiration
      maxAge: 24 * 60 * 60 * 1000,
    });

    const context = this.requestContextService.getContext();

    return {
      data: { user, token },
      meta: {
        requestId: context?.requestId ?? '',
        correlationId: context?.correlationId ?? '',
      },
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiEnvelope<Record<string, never>>> {
    if (user?.id) {
      await this.authService.logout(user.id);
    }

    // Clear the cookie
    response.clearCookie('classpod_token', {
      path: '/',
    });

    const context = this.requestContextService.getContext();

    return {
      data: {},
      meta: {
        requestId: context?.requestId ?? '',
        correlationId: context?.correlationId ?? '',
      },
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any): Promise<ApiEnvelope<any>> {
    const context = this.requestContextService.getContext();

    // Return the current user profile (minus passwordHash)
    const userProfile = { ...user };
    delete (userProfile as any).passwordHash;

    return {
      data: userProfile,
      meta: {
        requestId: context?.requestId ?? '',
        correlationId: context?.correlationId ?? '',
      },
    };
  }
}
