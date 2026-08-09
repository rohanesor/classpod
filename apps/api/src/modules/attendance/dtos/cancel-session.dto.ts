import { IsString, IsOptional } from 'class-validator';

export class CancelSessionDto {
  @IsString()
  sessionId!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
