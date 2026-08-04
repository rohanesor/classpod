import { IsString, IsNotEmpty, IsEnum, IsObject } from 'class-validator';
import { SignalSource } from '@prisma/client';

export class SubmitSignalDto {
  @IsString()
  @IsNotEmpty()
  attendanceDecisionId!: string;

  @IsEnum(SignalSource)
  source!: SignalSource;

  @IsObject()
  payload!: object;
}
