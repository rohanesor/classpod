import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class HeartbeatDto {
  @IsString()
  @IsNotEmpty()
  gatewayId!: string;

  @IsString()
  @IsOptional()
  firmwareVersion?: string;
}
