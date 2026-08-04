import { IsString } from 'class-validator';

export class EndSessionDto {
  @IsString()
  sessionId!: string;
}
