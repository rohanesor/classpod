import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class DetectFrameDto {
  @IsString()
  @IsNotEmpty()
  image!: string;

  @IsNumber()
  @IsOptional()
  frameIndex?: number;

  @IsNumber()
  @IsOptional()
  timestamp?: number;

  @IsNumber()
  @IsOptional()
  expectedCount?: number;
}
