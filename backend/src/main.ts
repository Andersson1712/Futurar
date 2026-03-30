import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilitar CORS para el frontend
  app.enableCors({
    origin: [
      'http://localhost:5173', // Vite dev
      'http://localhost:3000',
      'http://localhost:4000', // Docker local dev
      'http://localhost:4173', // Vite preview
      /\.vercel\.app$/,       // Cualquier dominio de Vercel
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Validación global de DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  // Puerto configurable
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Backend API running on http://127.0.0.1:${port}`);
  console.log(`📚 AI endpoints available at http://localhost:${port}/ai`);
}
bootstrap();
