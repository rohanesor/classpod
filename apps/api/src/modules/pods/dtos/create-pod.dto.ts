import { IsString, MinLength, IsOptional } from 'class-validator';

export class CreatePodDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsString()
  subjectCode!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  semester?: string;

  @IsString()
  @IsOptional()
  section?: string;

  @IsOptional()
  geoBoundary?: { lat: number; lng: number }[];
}
