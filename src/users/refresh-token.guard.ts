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
    console.log('Refresh token:', token);

    if (!token) {
      // throw new UnauthorizedException('Refresh token not found');
      return false;
    }

    try {
      const secret = String(this.configService.get('JWT_REFRESH_SECRET'));
      console.log('Refresh secret:', secret);
      const payload = await this.jwtService.verifyAsync(token, {
        secret: secret,
      });
      // FIXED: Store full payload including jti for service to use
      request['user'] = payload;
    } catch (error) {
      console.error('Refresh token verification error:', error);
      // throw new UnauthorizedException('Invalid or expired refresh token');
      return false;
    }

    return true;
  }

  private extractTokenFromCookie(request: Request): string | undefined {
    return request.cookies?.[this.cookieName];
  }
}