import { Controller, Get, Post, Param, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { RequestContextService } from '@/common/observability/request-context.service';
import { UserRole, SignalSource } from '@prisma/client';
import { VerificationService } from '../services/verification.service';
import { SubmitSignalDto } from '../dtos/submit-signal.dto';
import { IsString, IsOptional } from 'class-validator';
import type { ApiEnvelope } from '@classpod/shared';

export class VerificationCheckinDto {
  @IsString()
  @IsOptional()
  decisionId?: string;

  @IsString()
  @IsOptional()
  studentId?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;
}

@Controller('verification')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER, UserRole.ADMIN)
export class VerificationController {
  constructor(
    private readonly verificationService: VerificationService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post('checkin')
  async verifyCheckin(@Body() dto: VerificationCheckinDto): Promise<ApiEnvelope<any>> {
    let decisionId = dto.decisionId;

    if (!decisionId) {
      if (!dto.studentId || !dto.sessionId) {
        throw new BadRequestException('Either decisionId or both studentId and sessionId must be provided');
      }

      const decision = await this.verificationService.findDecisionBySessionAndStudent(dto.sessionId, dto.studentId);

      if (!decision) {
        throw new BadRequestException('No attendance decision found for the provided sessionId and studentId');
      }

      decisionId = decision.id;
    }

    const signal = await this.verificationService.submitSignal({
      attendanceDecisionId: decisionId,
      source: SignalSource.CHECK_IN,
      payload: {
        method: 'api_override',
        timestamp: new Date().toISOString(),
      },
    });

    const ctx = this.requestContext.getContext();
    return {
      data: signal,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }

  @Post('evidence')
  async submitEvidence(@Body() dto: SubmitSignalDto): Promise<ApiEnvelope<any>> {
    const signal = await this.verificationService.submitSignal(dto);
    const ctx = this.requestContext.getContext();
    return {
      data: signal,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }

  @Get(':decisionId')
  async getVerificationDetail(@Param('decisionId') decisionId: string): Promise<ApiEnvelope<any>> {
    const data = await this.verificationService.getDecisionWithEvidence(decisionId);
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
