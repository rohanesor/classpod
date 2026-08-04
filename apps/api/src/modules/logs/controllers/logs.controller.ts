import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { LogsService } from '../services/logs.service';

@Controller('logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('requests')
  async getRequestLogs(
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.logsService.getRequestLogs(search, status, page, limit);
  }

  @Get('audits')
  async getAuditLogs(
    @Query('search') search?: string,
    @Query('action') action?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.logsService.getAuditLogs(search, action, page, limit);
  }

  @Get('events')
  async getEventLogs(
    @Query('search') search?: string,
    @Query('eventName') eventName?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    return this.logsService.getEventLogs(search, eventName, page, limit);
  }

  @Get('metrics')
  async getMetrics() {
    return this.logsService.getMetrics();
  }
}
