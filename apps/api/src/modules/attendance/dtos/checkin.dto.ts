import { IsString, IsOptional } from 'class-validator';

export class CheckinDto {
  @IsString()
  sessionId!: string;

  @IsString()
  @IsOptional()
  gatewayId?: string;

  @IsString()
  @IsOptional()
  challengeToken?: string;
}
