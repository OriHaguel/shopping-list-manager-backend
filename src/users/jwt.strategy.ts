import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: String(configService.get('JWT_SECRET')),
    });
  }

  async validate(payload: any) {
    // For now, we'll just return the payload.
    // In a real app, you might want to look up the user in the database.
    return { userId: payload.sub, email: payload.email };
  }
}
