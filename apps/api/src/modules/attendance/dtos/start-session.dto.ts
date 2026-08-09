import { IsString, IsNumber, IsOptional, IsObject } from 'class-validator';

export class StartSessionDto {
  @IsString()
  podId!: string;

  @IsNumber()
  @IsOptional()
  duration?: number = 90;

  @IsOptional()
  @IsObject()
  baselineObservation?: {
    gatewayId?: string;
    personCount: number;
    confidence: number;
    expectedCount?: number;
    difference?: number;
    image?: string;
    framesAnalyzed?: number;
    consensusScore?: number;
  };
}
