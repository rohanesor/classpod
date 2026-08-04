import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @IsOptional()
  @IsString()
  heardFrom?: string;

  @IsOptional()
  @IsString()
  onboardingReason?: string;
}
