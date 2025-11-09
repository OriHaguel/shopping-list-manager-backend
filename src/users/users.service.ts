import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken } from './entities/refresh-token.entity';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  async signup(createUserDto: CreateUserDto) {
    const existingUser = await this.userModel.findOne({ email: createUserDto.email });
    if (existingUser) throw new ConflictException('Email already exists');

    const hashedPassword = await bcrypt.hash(createUserDto.password, 12);
    const createdUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
    });
    const user = await createdUser.save();

    return this.issueTokens(user);
  }

  async login(loginDto: LoginDto) {
    const user = await this.userModel.findOne({ email: loginDto.email }).select('+password');

    // Always hash the password even if user doesn't exist (constant-time)
    const passwordToCompare = user?.password || '$2b$12$dummyhashtopreventtimingattack1234567890123456789012';
    const isPasswordMatching = await bcrypt.compare(loginDto.password, passwordToCompare);

    if (!user || !isPasswordMatching) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user);
  }

  async logout(jti: string) {
    const tokenDoc = await this.refreshTokenModel.findOne({
      jti: jti,
      isRevoked: false,
    });

    if (tokenDoc) {
      tokenDoc.isRevoked = true;
      tokenDoc.rotatedAt = new Date(); // Mark rotation time
      await tokenDoc.save();
    }
  }

  async revokeAllUserTokens(userId: string) {
    await this.refreshTokenModel.updateMany(
      { userId, isRevoked: false },
      { $set: { isRevoked: true, rotatedAt: new Date() } }, // Mark rotation time
    );
  }

  private async issueTokens(user: User, oldJti?: string) {
    const jti = crypto.randomBytes(32).toString('hex');
    const payload = { sub: user._id, email: user.email, jti };

    // Access token (human-readable duration)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'), // e.g., '15m'
    });

    // Refresh token
    const refreshJti = crypto.randomBytes(32).toString('hex');
    const refreshPayload = { sub: user._id, email: user.email, jti: refreshJti, accessJti: jti };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: Number(this.configService.get('JWT_REFRESH_EXPIRES_IN_SECONDS')), // Pass as number
    });

    // Calculate expiry for cookie / DB
    const expiresAt = new Date(Date.now() + (Number(this.configService.get('JWT_REFRESH_EXPIRES_IN_SECONDS')) * 1000));

    // Revoke old token if one is passed
    if (oldJti) {
      const oldToken = await this.refreshTokenModel.findOne({ jti: oldJti });
      if (oldToken) {
        oldToken.isRevoked = true;
        oldToken.rotatedAt = new Date();
        await oldToken.save();
      }
    }

    // Save new refresh token in DB
    await this.refreshTokenModel.create({
      jti: refreshJti,
      userId: user._id,
      expiresAt,
      isRevoked: false,
    });

    return {
      accessToken,
      refreshToken,
      user: { _id: user._id, email: user.email },
    };
  }

  async refresh(refreshTokenJti: string, userId: string) {
    const tokenDoc = await this.refreshTokenModel.findOne({
      jti: refreshTokenJti,
      userId: userId,
    });

    if (!tokenDoc) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const now = new Date();

    if (tokenDoc.isRevoked) {
      // Check if the token is within the grace period
      const gracePeriodEnd = this.getGracePeriod(tokenDoc.rotatedAt);
      if (now > gracePeriodEnd) {
        // REUSE DETECTED: Token was used/revoked after grace period - revoke all user tokens
        await this.revokeAllUserTokens(userId);
        throw new UnauthorizedException('Token reuse detected - all sessions invalidated');
      }
    }

    if (tokenDoc.expiresAt < now) {
      throw new UnauthorizedException('Refresh token expired');
    }

    // If token is in grace period, don't issue new one, just return existing valid one
    if (tokenDoc.isRevoked) {
      const unrevokedToken = await this.refreshTokenModel.findOne({
        userId: userId,
        isRevoked: false,
        expiresAt: { $gt: now }
      });
      // This should ideally find the newest token, but for now, any valid one is fine
      if (unrevokedToken) {
        const user = await this.userModel.findById(tokenDoc.userId);
        if (!user) throw new UnauthorizedException('User not found');

        // Re-issue tokens based on the valid, unrevoked token's user
        // This avoids creating a new token when one is already pending rotation
        return this.issueTokens(user, unrevokedToken.jti);
      }
    }

    // Standard Token Rotation: Mark current token as used
    tokenDoc.isRevoked = true;
    tokenDoc.rotatedAt = now;
    await tokenDoc.save();

    const user = await this.userModel.findById(tokenDoc.userId);
    if (!user) throw new UnauthorizedException('User not found');

    return this.issueTokens(user, refreshTokenJti);
  }

  private getGracePeriod(rotatedAt: Date | null): Date {
    const gracePeriod = new Date(0);
    if (rotatedAt) {
      const gracePeriodSeconds = Number(this.configService.get('JWT_REFRESH_GRACE_PERIOD_SECONDS'));
      gracePeriod.setTime(rotatedAt.getTime() + gracePeriodSeconds * 1000);
    }
    return gracePeriod;
  }

  @Cron('0 0 * * *')
  async cleanupExpiredTokens() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await this.refreshTokenModel.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { isRevoked: true, rotatedAt: { $lt: thirtyDaysAgo } }
      ]
    });
  }

  async findByEmail(email: string): Promise<User> {
    return this.userModel.findOne({ email }).exec();
  }

  findAll() {
    return `This action returns all users`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}