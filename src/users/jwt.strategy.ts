import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: String(configService.get('JWT_SECRET')),
    });
  }

  async validate(payload: any) {
    // Verify the user still exists in the database
    const user = await this.userModel.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return { userId: payload.sub, email: payload.email };
  }
}