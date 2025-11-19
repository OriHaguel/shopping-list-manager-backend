import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Res, Req } from '@nestjs/common';
import { RefreshTokenGuard } from './refresh-token.guard';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from './csrf.service';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';

@Controller('api/users')
export class UsersController {
  private readonly refreshTokenCookieName: string;
  private readonly isProduction: boolean;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly csrfService: CsrfService,
  ) {
    this.isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    this.refreshTokenCookieName = this.isProduction ? '__Host-refresh-token' : 'refresh-token';
  }

  private getRefreshTokenMaxAge(): number {
    return Number(this.configService.get('JWT_REFRESH_EXPIRES_IN_SECONDS')) * 1000;
  }

  private getCookieOptions() {
    const baseOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict' as const,
      maxAge: this.getRefreshTokenMaxAge(),
      path: '/',
    };

    return baseOptions;
  }

  // New endpoint to get CSRF token
  @Get('csrf-token')
  getCsrfToken(@Res({ passthrough: true }) res: Response) {
    const csrfToken = this.csrfService.generateToken();
    this.csrfService.setCsrfCookie(res, csrfToken);
    return { csrfToken };
  }

  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('signup')
  @UseGuards(CsrfGuard)
  async signup(@Body() dto: CreateUserDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.usersService.signup(dto);
    res.cookie(this.refreshTokenCookieName, refreshToken, this.getCookieOptions());

    // Generate new CSRF token after signup
    const csrfToken = this.csrfService.generateToken();
    this.csrfService.setCsrfCookie(res, csrfToken);

    return { accessToken, user, csrfToken };
  }

  // @Throttle({ default: { limit: 5, ttl: 900000 } }) ==== uncoment======
  @Post('login')
  @UseGuards(CsrfGuard)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.usersService.login(loginDto);
    res.cookie(this.refreshTokenCookieName, refreshToken, this.getCookieOptions());

    // Generate new CSRF token after login
    const csrfToken = this.csrfService.generateToken();
    this.csrfService.setCsrfCookie(res, csrfToken);

    return { accessToken, user, csrfToken };
  }

  // @Throttle({ default: { limit: 1, ttl: 20000 } })
  @Post('refresh')
  // @UseGuards(RefreshTokenGuard)
  @UseGuards(RefreshTokenGuard, CsrfGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { jti, sub } = req.user as { jti: string, sub: string };
    const { accessToken, refreshToken, user } = await this.usersService.refresh(jti, sub);
    res.cookie(this.refreshTokenCookieName, refreshToken, this.getCookieOptions());
    // Generate new CSRF token after refresh
    const csrfToken = this.csrfService.generateToken();
    this.csrfService.setCsrfCookie(res, csrfToken);

    return { accessToken, user, csrfToken };
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Post('logout')
  @UseGuards(RefreshTokenGuard, CsrfGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { jti } = req.user as any;
    await this.usersService.logout(jti);
    res.clearCookie(this.refreshTokenCookieName, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'strict',
      path: '/',
    });

    // Clear CSRF token on logout
    this.csrfService.clearCsrfCookie(res);

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