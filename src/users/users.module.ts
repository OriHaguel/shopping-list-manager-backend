import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './entities/user.entity';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RefreshToken, RefreshTokenSchema } from './entities/refresh-token.entity';
import { RefreshTokenGuard } from './refresh-token.guard';
import { ScheduleModule } from '@nestjs/schedule'; // Import ScheduleModule for cron jobs

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // Enable scheduled tasks
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema }
    ]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') },
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, JwtStrategy, RefreshTokenGuard],
  exports: [JwtStrategy, PassportModule],
})
export class UsersModule { }