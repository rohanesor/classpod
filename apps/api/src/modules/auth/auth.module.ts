import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './services/auth.service';
import { BiometricsService } from './services/biometrics.service';
import { LoginRateLimiterService } from './services/login-rate-limiter.service';
import { AuthController } from './controllers/auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn', '1d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    BiometricsService,
    LoginRateLimiterService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, BiometricsService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}

