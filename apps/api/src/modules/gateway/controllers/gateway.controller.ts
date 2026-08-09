import { Controller, Get, Post, Param, Query, Body, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { RequestContextService } from '@/common/observability/request-context.service';
import { UserRole } from '@prisma/client';
import { GatewaySecretGuard } from '../guards/gateway-secret.guard';
import { GatewayService } from '../services/gateway.service';
import { HeartbeatDto } from '../dtos/heartbeat.dto';
import { SubmitObservationDto } from '../dtos/submit-observation.dto';
import type { ApiEnvelope } from '@classpod/shared';

@Controller('gateway')
export class GatewayController {
  constructor(
    private readonly gatewayService: GatewayService,
    private readonly requestContext: RequestContextService,
  ) {}

  // --- Hardware endpoints (shared secret auth) ---

  @Post('heartbeat')
  @UseGuards(GatewaySecretGuard)
  async heartbeat(@Body() dto: HeartbeatDto): Promise<ApiEnvelope<any>> {
    const data = await this.gatewayService.heartbeat(dto);
    const ctx = this.requestContext.getContext();
    return {
      data,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }

  @Post('observations')
  @UseGuards(GatewaySecretGuard)
  async submitObservation(@Body() dto: SubmitObservationDto): Promise<ApiEnvelope<any>> {
    const data = await this.gatewayService.submitObservation(dto);
    const ctx = this.requestContext.getContext();
    return {
      data,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }

  // --- Dashboard endpoints (JWT auth, teacher/admin only) ---

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getStatus(): Promise<ApiEnvelope<any>> {
    const data = await this.gatewayService.getStatus();
    const ctx = this.requestContext.getContext();
    return {
      data,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }

  @Get(':id/observations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getObservations(
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<ApiEnvelope<any>> {
    const data = await this.gatewayService.getObservations(id, limit);
    const ctx = this.requestContext.getContext();
    return {
      data,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }

  @Post(':id/request-capture')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async requestCapture(@Param('id') id: string): Promise<ApiEnvelope<any>> {
    const data = await this.gatewayService.requestCapture(id);
    const ctx = this.requestContext.getContext();
    return {
      data,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }

  @Post(':id/simulate-observation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async simulateObservation(@Param('id') id: string, @Body() body: any): Promise<ApiEnvelope<any>> {
    const data = await this.gatewayService.submitObservation({
      gatewayId: id,
      sessionId: body?.sessionId,
      type: 'PERSON_COUNT',
      timestamp: new Date().toISOString(),
      payload: {
        width: 640,
        height: 480,
        frame_bytes: 14500,
        personCount: body?.personCount ?? 28,
        expectedCount: body?.expectedCount ?? 30,
        difference: (body?.personCount ?? 28) - (body?.expectedCount ?? 30),
        confidence: 0.95,
        aiStatus: 'ANALYSIS_COMPLETE',
      },
    });
    const ctx = this.requestContext.getContext();
    return {
      data,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }

  @Get(':id/latest-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getLatestImage(@Param('id') id: string): Promise<ApiEnvelope<any>> {
    const data = await this.gatewayService.getLatestImage(id);
    const ctx = this.requestContext.getContext();
    return {
      data,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }

  @Get(':id/session-info')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getSessionInfo(@Param('id') id: string): Promise<ApiEnvelope<any>> {
    const data = await this.gatewayService.getSessionInfo(id);
    const ctx = this.requestContext.getContext();
    return {
      data,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }

  @Post(':id/toggle-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async toggleStatus(@Param('id') id: string, @Body() body: any): Promise<ApiEnvelope<any>> {
    const data = await this.gatewayService.toggleStatus(id, body?.status);
    const ctx = this.requestContext.getContext();
    return {
      data,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }
}
