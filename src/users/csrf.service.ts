import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class CsrfService {
    private readonly isProduction: boolean;
    private readonly csrfCookieName: string;
    private readonly domain: string;

    constructor(private readonly configService: ConfigService) {
        this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        this.csrfCookieName = this.isProduction ? '__Host-csrf-token' : 'csrf-token';
        this.domain = this.configService.get<string>('COOKIE_DOMAIN') || undefined;
    }

    generateToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    setCsrfCookie(res: Response, token: string): void {
        const cookieOptions: any = {
            httpOnly: true,
            secure: this.isProduction,
            sameSite: this.isProduction ? 'none' as const : 'lax' as const,
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: '/',
        };

        if (this.isProduction) {
            cookieOptions.partitioned = true;
            if (this.domain) {
                cookieOptions.domain = this.domain;
            }
        }

        res.cookie(this.csrfCookieName, token, cookieOptions);
    }

    clearCsrfCookie(res: Response): void {
        const options: any = {
            httpOnly: true,
            secure: this.isProduction,
            sameSite: this.isProduction ? 'none' : 'lax',
            path: '/',
        };
        if (this.domain) {
            options.domain = this.domain;
        }

        if (this.isProduction) {
            options.partitioned = true;
        }

        res.clearCookie(this.csrfCookieName, options);
    }
}