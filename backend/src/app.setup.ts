import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AiExceptionFilter } from './common/filters/ai-exception.filter';

export const API_PREFIX = 'api/v1';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalFilters(new AiExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
}
