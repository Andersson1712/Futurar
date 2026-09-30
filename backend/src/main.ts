import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for the frontend.
  app.enableCors({
    origin: [
      'http://localhost:5173', // Vite dev
      'http://localhost:3000',
      'http://localhost:4173', // Vite preview
      /\.vercel\.app$/, // Any Vercel domain
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Global DTO validation.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Configurable port.
  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Backend API running on http://localhost:${port}`);
}

void bootstrap();
