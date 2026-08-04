import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsObject } from 'class-validator';
import { NotificationPriority } from '@prisma/client';

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority;

  @IsInt()
  @IsOptional()
  expiresInSeconds?: number;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
