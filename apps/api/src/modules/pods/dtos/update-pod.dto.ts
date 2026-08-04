import { IsString, MinLength, IsOptional } from 'class-validator';

export class UpdatePodDto {
  @IsString()
  @MinLength(3)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  subjectCode?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  semester?: string;

  @IsString()
  @IsOptional()
  section?: string;
}
