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

    // FIXED: Increased bcrypt rounds from 10 to 12 for better security
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
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isPasswordMatching = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordMatching) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
  }

  // FIXED: Accept jti directly instead of re-verifying token
  async logout(jti: string) {
    const tokenDoc = await this.refreshTokenModel.findOne({
      jti: jti,
      isRevoked: false,
    });

    if (tokenDoc) {
      tokenDoc.isRevoked = true;
      await tokenDoc.save();
    }
  }

  async revokeAllUserTokens(userId: string) {
    await this.refreshTokenModel.updateMany(
      { userId, isRevoked: false },
      { $set: { isRevoked: true } },
    );
  }

  private async issueTokens(user: User) {
    const payload = { sub: user._id, email: user.email };

    const jti = crypto.randomBytes(32).toString('hex');

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'),
    });

    const refreshExpirationSeconds = this.configService.get<number>('JWT_REFRESH_EXPIRES_IN_SECONDS');

    const refreshPayload = { ...payload, jti };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpirationSeconds,
    });

    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + refreshExpirationSeconds * 1000);

    await this.refreshTokenModel.create({
      jti: jti,
      userId: user._id,
      expiresAt: expiresAt,
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
      isRevoked: false,
    });

    if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Token Rotation
    tokenDoc.isRevoked = true;
    await tokenDoc.save();

    const user = await this.userModel.findById(tokenDoc.userId);
    if (!user) throw new UnauthorizedException('User not found');

    return this.issueTokens(user);
  }

  @Cron('0 0 * * *')
  async cleanupExpiredTokens() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await this.refreshTokenModel.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { isRevoked: true, createdAt: { $lt: thirtyDaysAgo } }
      ]
    });
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