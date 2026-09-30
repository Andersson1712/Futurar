import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { configureApp } from '../app.setup';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { InMemoryIdempotencyStore } from '../common/idempotency/in-memory-idempotency.store';
import { IDEMPOTENCY_STORE } from '../common/idempotency/idempotency-store';
import { SupabaseService } from '../supabase/supabase.service';
import { AiController } from '../ai/ai.controller';
import { BOOK_GENERATION_USE_CASE } from '../ai/application/book-generation.use-case';
import { AiEndpointsEnabledGuard } from '../ai/guards/ai-endpoints-enabled.guard';
import { isSwaggerEnabled } from './swagger';

describe('swagger', () => {
  describe('isSwaggerEnabled', () => {
    it('respects SWAGGER_ENABLED', () => {
      expect(
        isSwaggerEnabled(new ConfigService({ SWAGGER_ENABLED: false })),
      ).toBe(false);
      expect(
        isSwaggerEnabled(new ConfigService({ SWAGGER_ENABLED: true })),
      ).toBe(true);
    });

    it('defaults to disabled in production', () => {
      expect(
        isSwaggerEnabled(new ConfigService({ NODE_ENV: 'production' })),
      ).toBe(false);
      expect(
        isSwaggerEnabled(new ConfigService({ NODE_ENV: 'development' })),
      ).toBe(true);
    });
  });

  it('documents the AI contracts', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AiController],
      providers: [
        ConfigService,
        SupabaseService,
        { provide: IDEMPOTENCY_STORE, useClass: InMemoryIdempotencyStore },
        {
          provide: BOOK_GENERATION_USE_CASE,
          useValue: { requestGeneration: jest.fn(), getJobStatus: jest.fn() },
        },
      ],
    })
      .overrideGuard(AiEndpointsEnabledGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const paths = Object.keys(document.paths);
    const schemas = document.components?.schemas ?? {};

    expect(paths.some((path) => path.endsWith('/ai/books/generate'))).toBe(
      true,
    );
    expect(paths.some((path) => path.endsWith('/ai/jobs/{id}'))).toBe(true);
    expect(schemas.GenerateBookRequestDto).toBeDefined();
    expect(schemas.GenerateBookResponseDto).toBeDefined();
    expect(schemas.AiErrorDto).toBeDefined();

    await app.close();
  });
});
