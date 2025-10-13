import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as cookieParser from 'cookie-parser';
import { getConnectionToken } from '@nestjs/mongoose';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  if (process.env.NODE_ENV !== 'production') {
    const connection = app.get(getConnectionToken());
    await connection.syncIndexes();
    console.log('Indexes synchronized');
  }
  app.enableCors({
    origin: [
      'http://127.0.0.1:3000',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://127.0.0.1:5174',
      'http://localhost:5174',
    ],
    credentials: true,
  });
  app.use(helmet());
  app.use(cookieParser());
  await app.listen(process.env.PORT ?? 3030);
}
bootstrap();

