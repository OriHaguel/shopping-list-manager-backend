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
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService, // 🔑 Inject ConfigService
  ) { }

  // 🔑 Helper to get refresh token maxAge in milliseconds
  private getRefreshTokenMaxAge(): number {
    // Get the expiration in seconds and convert to milliseconds
    return this.configService.get<number>('JWT_REFRESH_EXPIRES_IN_SECONDS') * 1000;
  }

  @Post('signup')
  async signup(@Body() dto: CreateUserDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.usersService.signup(dto);

    res.cookie('__Host-refresh-token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.getRefreshTokenMaxAge(), // 🔑 Use dynamic config
      path: '/'
    });

    return { accessToken, user };
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, user } = await this.usersService.login(loginDto);
    res.cookie('__Host-refresh-token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.getRefreshTokenMaxAge(), // 🔑 Use dynamic config
      path: '/'
    });
    return { accessToken, user };
  }


  @Post('refresh')
  @UseGuards(RefreshTokenGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Assuming the RefreshTokenGuard successfully verified and put the payload in req.user
    // and the raw token is available in the cookies
    const oldRefreshToken = req.cookies['__Host-refresh-token']; // Get the raw token from the cookie

    // Get the new tokens from the service
    const { accessToken, refreshToken, user } = await this.usersService.refresh(oldRefreshToken); // Pass the old token

    // Set the NEW refresh token in the cookie
    res.cookie('__Host-refresh-token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: this.getRefreshTokenMaxAge(), // 🔑 Use dynamic config
      path: '/'
    });

    return { accessToken, user };
  }

  @Post('logout')
  @UseGuards(RefreshTokenGuard) // Use the guard to ensure a valid session
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies['__Host-refresh-token'];

    await this.usersService.logout(refreshToken);

    // Clear the cookie from the client
    res.clearCookie('__Host-refresh-token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/', // 🔑 ADDED: Ensure the path matches the set options for reliable deletion
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