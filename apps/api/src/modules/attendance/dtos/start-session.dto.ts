import { IsString, IsNumber, IsOptional } from 'class-validator';

export class StartSessionDto {
  @IsString()
  podId!: string;

  @IsNumber()
  @IsOptional()
  duration?: number = 90;
}
