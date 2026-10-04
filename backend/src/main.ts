import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { setupSwagger } from './config/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);

  app.useLogger(logger);
  configureApp(app);

  // Enable CORS for the frontend.
  // NOTE: every method the frontend sends (GET/POST/PUT/PATCH/DELETE) must be
  // listed here, otherwise the preflight fails and the browser blocks the
  // call (seen with PATCH /profiles/:id from the teacher panel).
  app.enableCors({
    origin: [
      'http://localhost:5173', // Vite dev
      'http://localhost:3000',
      'http://localhost:4173', // Vite preview
      /\.vercel\.app$/, // Any Vercel domain
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'x-correlation-id',
    ],
    credentials: true,
  });

  // Configurable port.
  const port = process.env.PORT || 3001;

  setupSwagger(app);

  await app.listen(port);

  logger.log(`Backend API running on http://localhost:${port}/api/v1`);
}

void bootstrap();
