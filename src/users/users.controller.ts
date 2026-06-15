import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Res, Req, Query } from '@nestjs/common';
import { RefreshTokenGuard } from './refresh-token.guard';
import { Request } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { LoginGuestDto } from './dto/login-guest.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CsrfGuard } from './csrf.guard';
import { CsrfService } from './csrf.service';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';

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

  private getOAuthUserIdCookieName(): string {
    return this.isProduction ? '__Host-oauth-userId' : 'oauth-userId';
  }

  private getCookieOptions() {
    const baseOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'none' as const : 'lax' as const,
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

  @Post('create-guest')
  async createGuestUser(@Res({ passthrough: true }) res: Response) {
    try {
      const { accessToken, refreshToken, user } = await this.usersService.createGuestUser();
      res.cookie(this.refreshTokenCookieName, refreshToken, this.getCookieOptions());
      const csrfToken = this.csrfService.generateToken();
      this.csrfService.setCsrfCookie(res, csrfToken);
      return { accessToken, user, csrfToken };
    } catch (error) {
      console.error('CRITICAL BACKEND ERROR:', error);
      throw error; // Let NestJS handle it, but now it's definitely logged
    }
  }

  @Post('login-guest')
  async loginGuest(@Body() dto: LoginGuestDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.usersService.loginGuestUser(dto.userId);
    res.cookie(this.refreshTokenCookieName, refreshToken, this.getCookieOptions());

    // Generate new CSRF token after guest login
    const csrfToken = this.csrfService.generateToken();
    this.csrfService.setCsrfCookie(res, csrfToken);

    return { accessToken, user, csrfToken };
  }

  @Throttle({ default: { limit: 25, ttl: 600000 } })
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

  @Throttle({ default: { limit: 25, ttl: 600000 } })
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

  @Get('google/start')
  async googleStart(@Query('userId') userId: string, @Res({ passthrough: true }) res: Response) {
    // Store userId in a temporary cookie that survives the redirect
    if (userId) {
      res.cookie(this.getOAuthUserIdCookieName(), userId, {
        httpOnly: true,
        secure: this.isProduction,
        sameSite: this.isProduction ? 'none' as const : 'lax' as const,
        maxAge: 10 * 60 * 1000, // 10 minutes
        path: '/',
      });
    }
    const backendUrl = this.isProduction
      ? this.configService.get<string>('BACKEND_URL_PROD')
      : this.configService.get<string>('BACKEND_URL_DEV');
    // Return the Google OAuth login URL
    return res.redirect(`${backendUrl}/api/users/google/login`);
  }

  @Get('google/login')
  @UseGuards(AuthGuard('google'))
  async googleLogin() {
    // AuthGuard('google') will redirect to Google's OAuth endpoint
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req, @Res({ passthrough: true }) res: Response) {
    // Retrieve the userId that was stored in the cookie
    const userId = req.cookies[this.getOAuthUserIdCookieName()];

    const { refreshToken } = await this.usersService.findOrCreateGoogleUser(req.user, userId);
    res.cookie(this.refreshTokenCookieName, refreshToken, this.getCookieOptions());

    // Generate new CSRF token after login
    const csrfToken = this.csrfService.generateToken();
    this.csrfService.setCsrfCookie(res, csrfToken);

    // Clear the temporary OAuth userId cookie
    res.clearCookie(this.getOAuthUserIdCookieName(), {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'none' as const : 'lax' as const,
      path: '/',
    });

    const frontendUrl = this.isProduction
      ? this.configService.get<string>('FRONTEND_URL_PROD')
      : this.configService.get<string>('FRONTEND_URL_DEV');

    res.redirect(`${frontendUrl}/list`);
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('refresh')
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

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('logout')
  @UseGuards(RefreshTokenGuard, CsrfGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { jti } = req.user as any;
    await this.usersService.logout(jti);
    res.clearCookie(this.refreshTokenCookieName, {
      ...this.getCookieOptions(),
      maxAge: 0,
    });

    // Clear CSRF token on logout
    this.csrfService.clearCsrfCookie(res);

    return { message: 'Logout successful' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('all')
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Post('email')
  findUserEmail(@Body('usersId') usersId: string[], @Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.usersService.findUsersEmail(usersId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findOne(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.usersService.findOne(userId);
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