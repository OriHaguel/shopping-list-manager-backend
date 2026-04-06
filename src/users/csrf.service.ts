import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CsrfService {
    private readonly isProduction: boolean;
    private readonly csrfCookieName: string;

    constructor(private readonly configService: ConfigService) {
        this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        this.csrfCookieName = this.isProduction ? '__Host-csrf-token' : 'csrf-token';
    }

    generateToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    setCsrfCookie(res: Response, token: string): void {
        const cookieOptions = {
            httpOnly: true,
            secure: this.isProduction,
            sameSite: this.isProduction ? 'none' as const : 'lax' as const,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: '/',
        };

        res.cookie(this.csrfCookieName, token, cookieOptions);
    }

    clearCsrfCookie(res: Response): void {
        res.clearCookie(this.csrfCookieName, {
            httpOnly: true,
            secure: this.isProduction,
            sameSite: this.isProduction ? 'none' : 'lax',
            path: '/',
        });
    }
}