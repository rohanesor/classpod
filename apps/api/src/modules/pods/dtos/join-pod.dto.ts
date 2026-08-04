import { IsString, Length } from 'class-validator';

export class JoinPodDto {
  @IsString()
  @Length(6, 8)
  joinCode!: string;
}
