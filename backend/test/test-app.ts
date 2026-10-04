/**
 * SPEC-028 — E2E bootstrap helper (test-only).
 *
 * Boots the real AppModule with the provider boundary mocked:
 * - Gemini text/image/TTS adapters replaced by controllable stubs (no network)
 * - QUEUE_DRIVER=inline, REDIS_CLIENT=null (Redis-down proof, no BullMQ)
 * - SupabaseService client forced to null (in-memory repositories + storage)
 * - SupabaseAuthGuard replaced by a header-token double (401 without token)
 * - ThrottlerGuard bypassed so the suite never flakes on 429s
 *
 * Secrets are mocked placeholders only; never real credentials.
 */
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { App } from 'supertest/types';
import {
  IMAGE_GENERATOR,
  TEXT_GENERATOR,
  TTS_GENERATOR,
} from '../src/ai/tokens';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { BOOK_STORAGE } from '../src/books/book-storage.port';
import { AiErrorException } from '../src/common/errors/ai-error.exception';
import { SupabaseAuthGuard } from '../src/common/guards/supabase-auth.guard';
import { REDIS_CLIENT } from '../src/common/redis/redis-client';
import { SupabaseService } from '../src/supabase/supabase.service';

export const E2E_TEST_TOKEN = 'e2e-test-token';
export const E2E_TEST_USER_ID = 'e2e-user-1';
export const E2E_CORRELATION_ID = 'e2e-corr-0001';

export const VALID_BOOK_TITLE = 'La aventura del dragon valiente';

export const VALID_GENERATE_BODY = {
  protagonist: 'Un dragon curioso',
  scenery: 'Un bosque magico',
  mission: 'Encontrar la estrella perdida',
  style: 'Acuarela',
  storySize: 'small',
} as const;

export const VALID_DESIGN_TITLE = 'Fiesta de cumple';

export const VALID_DESIGN_BODY = {
  occasion: 'birthday',
  message: 'Fiesta de cumple el sabado a las 17',
  style: 'Acuarela',
} as const;

export interface AiE2ETestContext {
  app: INestApplication<App>;
  mockTextGenerate: jest.Mock;
  mockImageGenerate: jest.Mock;
}

export interface AiE2ETestAppOptions {
  designEndpointsEnabled?: boolean;
  designImagesEnabled?: boolean;
}

function applyE2ETestEnv(options: AiE2ETestAppOptions = {}): void {
  process.env.NODE_ENV = 'test';
  process.env.AI_ENDPOINTS_ENABLED = 'true';
  process.env.QUEUE_DRIVER = 'inline';
  process.env.LOG_LEVEL = 'error';
  process.env.THROTTLE_LIMIT = '1000';
  process.env.THROTTLE_TTL_MS = '60000';
  process.env.GEMINI_API_KEY ??= 'e2e-mock-gemini-key';
  process.env.SUPABASE_URL ??= 'https://e2e-test.supabase.co';
  process.env.SUPABASE_SERVICE_KEY ??= 'e2e-mock-service-key';
  delete process.env.REDIS_URL;
  delete process.env.BOOK_IMAGES_ENABLED;
  if (options.designEndpointsEnabled === false) {
    delete process.env.DESIGN_ENDPOINTS_ENABLED;
  } else {
    process.env.DESIGN_ENDPOINTS_ENABLED = 'true';
  }
  if (options.designImagesEnabled === false) {
    delete process.env.DESIGN_IMAGES_ENABLED;
  } else {
    process.env.DESIGN_IMAGES_ENABLED = 'true';
  }
}

interface AuthenticatedTestRequest {
  headers?: Record<string, string | string[] | undefined>;
  user?: { id: string };
}

function testAuthGuard() {
  return {
    canActivate: (context: ExecutionContext): boolean => {
      const request = context
        .switchToHttp()
        .getRequest<AuthenticatedTestRequest>();
      const rawAuthorization = request.headers?.authorization;
      const authorization = Array.isArray(rawAuthorization)
        ? rawAuthorization[0]
        : rawAuthorization;

      if (authorization !== `Bearer ${E2E_TEST_TOKEN}`) {
        throw new AiErrorException(401, 'UNAUTHORIZED', 'Missing Bearer token');
      }

      request.user = { id: E2E_TEST_USER_ID };
      return true;
    },
  };
}

export async function createAiE2ETestApp(
  options: AiE2ETestAppOptions = {},
): Promise<AiE2ETestContext> {
  applyE2ETestEnv(options);

  const mockTextGenerate = jest.fn();
  const mockImageGenerate = jest
    .fn()
    .mockRejectedValue(new Error('images disabled'));
  const storedFiles = new Map<string, Buffer>();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(SupabaseService)
    .useValue({ getClient: () => null })
    .overrideProvider(TEXT_GENERATOR)
    .useValue({ generate: mockTextGenerate })
    .overrideProvider(IMAGE_GENERATOR)
    .useValue({ generate: mockImageGenerate })
    .overrideProvider(BOOK_STORAGE)
    .useValue({
      upload: (path: string, data: Buffer): Promise<void> => {
        storedFiles.set(path, data);
        return Promise.resolve();
      },
      signedUrl: (path: string): Promise<string> =>
        Promise.resolve(`https://storage.test/${path}`),
    })
    .overrideProvider(TTS_GENERATOR)
    .useValue({})
    .overrideProvider(REDIS_CLIENT)
    .useValue(null)
    .overrideGuard(SupabaseAuthGuard)
    .useValue(testAuthGuard())
    // NOTE: the throttler is registered via APP_GUARD (not @UseGuards), so
    // overrideGuard(ThrottlerGuard) does not apply, and the 5/min @Throttle()
    // on generate would flap the suite with 429s. Neutralize its in-memory
    // counters instead (test-only; production wiring untouched).
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: (): Promise<{
        totalHits: number;
        timeToExpire: number;
        isBlocked: boolean;
        timeToBlockExpire: number;
      }> =>
        Promise.resolve({
          totalHits: 0,
          timeToExpire: 0,
          isBlocked: false,
          timeToBlockExpire: 0,
        }),
    })
    .compile();

  const app: INestApplication<App> = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, mockTextGenerate, mockImageGenerate };
}

export async function closeAiE2ETestApp(
  app: INestApplication<App> | undefined,
): Promise<void> {
  if (app) await app.close();
}
