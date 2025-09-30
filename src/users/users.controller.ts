import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Res, Req } from '@nestjs/common';
import { RefreshTokenGuard } from './refresh-token.guard';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config'; // 🔑 ADD ConfigService

@Controller('api/users')
export class UsersController {
  private readonly refreshTokenCookieName: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
    this.refreshTokenCookieName =
      process.env.NODE_ENV === 'production'
        ? '__Host-refresh-token'
        : 'refresh-token';
  }

  private getRefreshTokenMaxAge(): number {
    return this.configService.get<number>('JWT_REFRESH_EXPIRES_IN_SECONDS') * 1000;
  }

  @Post('signup')
  async signup(@Body() dto: CreateUserDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.usersService.signup(dto);

    res.cookie(this.refreshTokenCookieName, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.getRefreshTokenMaxAge(),
      path: '/',
    });

    return { accessToken, user };
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.usersService.login(loginDto);
    res.cookie(this.refreshTokenCookieName, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.getRefreshTokenMaxAge(),
      path: '/',
    });
    return { accessToken, user };
  }

  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const oldRefreshToken = req.cookies[this.refreshTokenCookieName];
    const { accessToken, refreshToken, user } = await this.usersService.refresh(oldRefreshToken);

    res.cookie(this.refreshTokenCookieName, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.getRefreshTokenMaxAge(),
      path: '/',
    });

    return { accessToken, user };
  }

  @Post('logout')
  @UseGuards(RefreshTokenGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies[this.refreshTokenCookieName];
    await this.usersService.logout(refreshToken);

    res.clearCookie(this.refreshTokenCookieName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return { message: 'Logout successful' };
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(+id);
  }
}