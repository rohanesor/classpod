import { IsString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CheckinDto {
  @IsString()
  sessionId!: string;

  @IsString()
  gatewayId!: string;

  @IsString()
  challengeToken!: string;

  @IsString()
  deviceId!: string;

  @IsBoolean()
  @IsOptional()
  isMobileApp?: boolean;

  @IsNumber()
  @IsOptional()
  bleRssi?: number;

  @IsBoolean()
  @IsOptional()
  biometricVerified?: boolean;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;
}

