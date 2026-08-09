import { IsString, IsInt, Min, Max } from 'class-validator';

export class ExtendSessionDto {
  @IsString()
  sessionId!: string;

  @IsInt()
  @Min(10)
  @Max(600)
  extraSeconds!: number;
}
