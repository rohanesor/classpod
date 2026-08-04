import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@/modules/auth/guards/roles.guard';
import { Roles } from '@/modules/auth/decorators/roles.decorator';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { UserRole, User } from '@prisma/client';
import { AutomationService } from '../services/automation.service';

@Controller('automation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Get('history')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getHistory(
    @CurrentUser() user: User,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    return this.automationService.getHistoryForTeacher(user.id, parsedLimit, parsedOffset);
  }

  @Get(':id')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async getRunById(@Param('id') id: string) {
    return this.automationService.getRunById(id);
  }

  @Post(':id/retrigger')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async retriggerRun(@Param('id') id: string, @CurrentUser() user: User) {
    return this.automationService.retriggerRun(id, user.id);
  }

  @Post(':id/resend')
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async resendWhatsApp(@Param('id') id: string, @CurrentUser() user: User) {
    return this.automationService.resendWhatsApp(id, user.id);
  }

  // Download endpoint for file artifacts
  @Get('artifacts/:artifactId/download')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT)
  async downloadArtifact(
    @Param('artifactId') artifactId: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const { artifact, filePath } = await this.automationService.getArtifactForDownload(artifactId);

    res.set({
      'Content-Type': artifact.mimeType,
      'Content-Disposition': `attachment; filename="${artifact.filename}"`,
    });

    const fileStream = fs.createReadStream(filePath);
    return new StreamableFile(fileStream);
  }

  @Get('artifacts/download')
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.STUDENT)
  async downloadArtifactByPath(
    @Query('path') storagePath: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const { artifact, filePath } = await this.automationService.getArtifactByPathForDownload(storagePath);

    const filename = artifact ? artifact.filename : storagePath.split('/').pop() || 'download';
    const mimeType = artifact ? artifact.mimeType : 'application/octet-stream';

    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    const fileStream = fs.createReadStream(filePath);
    return new StreamableFile(fileStream);
  }
}
