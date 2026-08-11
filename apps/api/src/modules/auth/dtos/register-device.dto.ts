import { IsString, IsOptional } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  deviceId!: string;

  @IsString()
  @IsOptional()
  platform?: string;
}
