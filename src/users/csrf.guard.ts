import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CsrfGuard implements CanActivate {
    private readonly isProduction: boolean;
    private readonly csrfCookieName: string;
    private readonly csrfHeaderName = 'x-csrf-token';

    constructor(private readonly configService: ConfigService) {
        this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        this.csrfCookieName = this.isProduction ? '__Host-csrf-token' : 'csrf-token';
    }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<Request>();
        const method = request.method;

        // Only check CSRF for state-changing methods
        if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
            return true;
        }

        const tokenFromCookie = request.cookies?.[this.csrfCookieName];
        const tokenFromHeader = request.headers[this.csrfHeaderName] as string;

        if (!tokenFromCookie || !tokenFromHeader) {
            throw new ForbiddenException('CSRF token missing');
        }

        // Compare tokens using constant-time comparison
        if (!this.secureCompare(tokenFromCookie, tokenFromHeader)) {
            throw new ForbiddenException('CSRF token mismatch');
        }

        return true;
    }

    // Constant-time string comparison to prevent timing attacks
    private secureCompare(a: string, b: string): boolean {
        if (a.length !== b.length) {
            return false;
        }
        return crypto.timingSafeEqual(
            Buffer.from(a, 'utf-8'),
            Buffer.from(b, 'utf-8')
        );
    }
}