import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class RefreshTokenGuard implements CanActivate {
  private readonly isProduction: boolean;
  private readonly cookieName: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.cookieName = this.isProduction ? '__Host-refresh-token' : 'refresh-token';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromCookie(request);

    if (!token) {
      throw new UnauthorizedException('Refresh token not found');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: String(this.configService.get('JWT_REFRESH_SECRET')),
      });
      // FIXED: Store full payload including jti for service to use
      request['user'] = payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return true;
  }

  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies?.[this.cookieName];
  }
}