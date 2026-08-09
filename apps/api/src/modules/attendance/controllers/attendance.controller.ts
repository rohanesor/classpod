import { Controller, Post, Body, Get, Param, UseGuards } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequestContextService } from '@/common/observability/request-context.service';
import { ApiEnvelope } from '@classpod/shared';
import { AttendanceService } from '../services/attendance.service';
import { StartSessionDto } from '../dtos/start-session.dto';
import { CheckinDto } from '../dtos/checkin.dto';
import { EndSessionDto } from '../dtos/end-session.dto';

@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly requestContextService: RequestContextService,
  ) {}

  private wrapResponse<T>(data: T): ApiEnvelope<T> {
    const context = this.requestContextService.getContext();
    return {
      data,
      meta: {
        requestId: context?.requestId ?? '',
        correlationId: context?.correlationId ?? '',
      },
    };
  }

  @Post('start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  async start(@CurrentUser() user: User, @Body() dto: StartSessionDto) {
    const data = await this.attendanceService.start(user.id, dto);
    return this.wrapResponse(data);
  }

  @Post('checkin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  async checkin(@CurrentUser() user: User, @Body() dto: CheckinDto) {
    const data = await this.attendanceService.checkin(user.id, dto);
    return this.wrapResponse(data);
  }

  @Post('end')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  async end(@CurrentUser() user: User, @Body() dto: EndSessionDto) {
    const data = await this.attendanceService.end(user.id, dto.sessionId);
    return this.wrapResponse(data);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT, UserRole.TEACHER)
  async active(@CurrentUser() user: User) {
    const data = await this.attendanceService.findActiveSessionForStudent(user.id);
    return this.wrapResponse(data);
  }

  @Get('session/:id')
  @UseGuards(JwtAuthGuard)
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.attendanceService.findOne(user.id, id);
    return this.wrapResponse(data);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async findAll(@CurrentUser() user: User) {
    const data =
      user.role === UserRole.TEACHER
        ? await this.attendanceService.findAllForTeacher(user.id)
        : await this.attendanceService.findAllForStudent(user.id);
    return this.wrapResponse(data);
  }

  @Get('session/:id/live')
  @UseGuards(JwtAuthGuard)
  async findLive(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.attendanceService.findLive(user.id, user.role, id);
    return this.wrapResponse(data);
  }
}
