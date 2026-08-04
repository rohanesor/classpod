import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GatewaySecretGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const secret = request.headers['x-gateway-secret'];

    if (!secret) {
      throw new UnauthorizedException('Gateway secret header missing');
    }

    const expectedSecret = this.configService.getOrThrow<string>('gateway.sharedSecret');

    if (secret !== expectedSecret) {
      throw new UnauthorizedException('Invalid gateway secret');
    }

    return true;
  }
}
