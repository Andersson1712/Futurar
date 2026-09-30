import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { setupSwagger } from './config/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  configureApp(app);

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

  // Configurable port.
  const port = process.env.PORT || 3001;

  setupSwagger(app);

  await app.listen(port);

  console.log(`🚀 Backend API running on http://localhost:${port}/api/v1`);
}

void bootstrap();
