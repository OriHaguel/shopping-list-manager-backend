import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { InjectModel } from '@nestjs/mongoose';
import { User } from './entities/user.entity';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RefreshToken } from './entities/refresh-token.entity';

import { ConfigService } from '@nestjs/config';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(RefreshToken.name) private refreshTokenModel: Model<RefreshToken>, // 🔑 NEW
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  async signup(createUserDto: CreateUserDto) {
    const existingUser = await this.userModel.findOne({ email: createUserDto.email });
    if (existingUser) throw new ConflictException('Email already exists');

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
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

  async logout(refreshToken: string) {
    // Find the token and set it as revoked
    await this.refreshTokenModel.updateOne(
      { token: refreshToken, isRevoked: false },
      { $set: { isRevoked: true } },
    );
    // No need to throw an error if the token is not found or already revoked.
  }

  private async issueTokens(user: User) {
    const payload = { sub: user._id, email: user.email };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN'),
    });

    const refreshExpirationSeconds = this.configService.get<number>('JWT_REFRESH_EXPIRES_IN_SECONDS');

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshExpirationSeconds,
    });

    const expiresAt = new Date();
    expiresAt.setTime(expiresAt.getTime() + refreshExpirationSeconds * 1000);

    // Revoke all existing valid refresh tokens for this user
    await this.refreshTokenModel.updateMany(
      { userId: user._id, isRevoked: false },
      { $set: { isRevoked: true } },
    );

    // Create the new refresh token
    await this.refreshTokenModel.create({
      token: refreshToken,
      userId: user._id,
      expiresAt: expiresAt,
    });

    return {
      accessToken,
      refreshToken,
      user: { _id: user._id, email: user.email }, // FIX: Ensure 'id' field is returned
    };
  }
  async refresh(oldRefreshToken: string) { // 🔑 ACCEPT OLD TOKEN
    // 1. Find and validate the old refresh token
    const tokenDoc = await this.refreshTokenModel.findOne({ token: oldRefreshToken });

    if (!tokenDoc || tokenDoc.isRevoked || tokenDoc.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // 2. Revoke the old token (Token Rotation)
    tokenDoc.isRevoked = true;
    await tokenDoc.save();

    // 3. Find the user and issue a new pair of tokens
    const user = await this.userModel.findById(tokenDoc.userId);
    if (!user) throw new UnauthorizedException('User not found');

    return this.issueTokens(user); // 🔑 Issues a new AT and a NEW RT (which is saved)
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
