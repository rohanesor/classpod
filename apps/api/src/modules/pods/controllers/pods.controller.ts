import { Controller, Post, Body, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequestContextService } from '@/common/observability/request-context.service';
import { ApiEnvelope } from '@classpod/shared';
import { PodsService } from '../services/pods.service';
import { CreatePodDto } from '../dtos/create-pod.dto';
import { UpdatePodDto } from '../dtos/update-pod.dto';
import { JoinPodDto } from '../dtos/join-pod.dto';

@Controller('pods')
export class PodsController {
  constructor(
    private readonly podsService: PodsService,
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

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  async create(@CurrentUser() user: User, @Body() dto: CreatePodDto) {
    const data = await this.podsService.create(user.id, dto);
    return this.wrapResponse(data);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  async findAllByTeacher(@CurrentUser() user: User) {
    const data = await this.podsService.findAllByTeacher(user.id);
    return this.wrapResponse(data);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  async findAllByStudent(@CurrentUser() user: User) {
    const data = await this.podsService.findAllByStudent(user.id);
    return this.wrapResponse(data);
  }

  @Post('join')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  async join(@CurrentUser() user: User, @Body() dto: JoinPodDto) {
    const data = await this.podsService.join(user.id, dto.joinCode);
    return this.wrapResponse(data);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.podsService.findOne(user.id, user.role, id);
    return this.wrapResponse(data);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdatePodDto,
  ) {
    const data = await this.podsService.update(user.id, id, dto);
    return this.wrapResponse(data);
  }

  @Post(':id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER)
  async archive(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.podsService.archive(user.id, id);
    return this.wrapResponse(data);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  async leave(@CurrentUser() user: User, @Param('id') id: string) {
    const data = await this.podsService.leave(user.id, id);
    return this.wrapResponse(data);
  }
}
