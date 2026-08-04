import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { RequestContextService } from '@/common/observability/request-context.service';
import { NotificationService } from '../services/notification.service';
import { CreateNotificationDto } from '../dtos/create-notification.dto';
import type { ApiEnvelope } from '@classpod/shared';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get()
  async getNotifications(@CurrentUser() user: any): Promise<ApiEnvelope<any>> {
    const data = await this.notificationService.findAllForUser(user.id);
    const ctx = this.requestContext.getContext();
    return {
      data,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }

  @Patch(':id/read')
  async markRead(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ): Promise<ApiEnvelope<any>> {
    const data = await this.notificationService.markAsRead(user.id, id);
    const ctx = this.requestContext.getContext();
    return {
      data,
      meta: {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
      },
    };
  }

  @Post('test')
  async testNotification(
    @Body() dto: CreateNotificationDto,
  ): Promise<ApiEnvelope<any>> {
    const data = await this.notificationService.create(
      dto.userId,
      dto.type,
      dto.metadata,
      dto.title,
      dto.body,
      dto.priority,
      dto.expiresInSeconds,
    );
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
