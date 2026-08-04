import { IsString, IsNotEmpty, IsOptional, IsEnum, IsObject, IsDateString } from 'class-validator';
import { GatewayObservationType } from '@prisma/client';

export class SubmitObservationDto {
  @IsString()
  @IsNotEmpty()
  gatewayId!: string;

  @IsEnum(GatewayObservationType)
  type!: GatewayObservationType;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsObject()
  payload!: object;

  @IsDateString()
  @IsOptional()
  timestamp?: string;
}
