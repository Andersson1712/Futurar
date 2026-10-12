import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function isSwaggerEnabled(configService: ConfigService): boolean {
  const configured = configService.get<boolean>('SWAGGER_ENABLED');

  if (configured !== undefined) return configured;

  return configService.get<string>('NODE_ENV') !== 'production';
}

export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);

  if (!isSwaggerEnabled(configService)) return;

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Futurar API')
      .setDescription(
        'Server-owned AI generation API. Provider keys never leave the backend.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );

  SwaggerModule.setup('docs', app, document, { useGlobalPrefix: true });
}
