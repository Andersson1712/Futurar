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

export const VALID_PRESENTATION_TITLE = 'Los dinosaurios';

export const VALID_PRESENTATION_BODY = {
  topic: 'Los dinosaurios',
  style: 'Acuarela',
  slideCount: 5,
} as const;

export const VALID_COMMUNICATION_TITLE = 'Mis sentimientos';

export const VALID_COMMUNICATION_BODY = {
  kind: 'feelings',
  topic: 'Cómo me siento hoy',
  style: 'Pictogramas',
  cellCount: 6,
} as const;

export interface AiE2ETestContext {
  app: INestApplication<App>;
  mockTextGenerate: jest.Mock;
  mockImageGenerate: jest.Mock;
}

export interface AiE2ETestAppOptions {
  designEndpointsEnabled?: boolean;
  designImagesEnabled?: boolean;
  presentationEndpointsEnabled?: boolean;
  presentationImagesEnabled?: boolean;
  communicationEndpointsEnabled?: boolean;
  communicationImagesEnabled?: boolean;
  exportsEnabled?: boolean;
  /**
   * SPEC-033: when true, TEXT/IMAGE_GENERATOR are NOT stubbed — the real
   * OpenRouter adapters wire through ai.module (OPENROUTER_ENABLED=true)
   * and tests mock HTTP (global fetch) instead of the adapters.
   */
  openRouterEnabled?: boolean;
}

function applyE2ETestEnv(options: AiE2ETestAppOptions = {}): void {
  process.env.NODE_ENV = 'test';
  process.env.AI_ENDPOINTS_ENABLED = 'true';
  process.env.QUEUE_DRIVER = 'inline';
  process.env.LOG_LEVEL = 'error';
  process.env.THROTTLE_LIMIT = '1000';
  process.env.THROTTLE_TTL_MS = '60000';
  process.env.GEMINI_API_KEY ??= 'e2e-mock-gemini-key';
  process.env.OPENROUTER_API_KEY ??= 'e2e-mock-openrouter-key';
  if (options.openRouterEnabled === true) {
    process.env.OPENROUTER_ENABLED = 'true';
  } else {
    delete process.env.OPENROUTER_ENABLED;
  }
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
  if (options.presentationEndpointsEnabled === false) {
    delete process.env.PRESENTATION_ENDPOINTS_ENABLED;
  } else {
    process.env.PRESENTATION_ENDPOINTS_ENABLED = 'true';
  }
  if (options.presentationImagesEnabled === false) {
    delete process.env.PRESENTATION_IMAGES_ENABLED;
  } else {
    process.env.PRESENTATION_IMAGES_ENABLED = 'true';
  }
  if (options.communicationEndpointsEnabled === false) {
    delete process.env.COMMUNICATION_ENDPOINTS_ENABLED;
  } else {
    process.env.COMMUNICATION_ENDPOINTS_ENABLED = 'true';
  }
  if (options.communicationImagesEnabled === false) {
    delete process.env.COMMUNICATION_IMAGES_ENABLED;
  } else {
    process.env.COMMUNICATION_IMAGES_ENABLED = 'true';
  }
  if (options.exportsEnabled === false) {
    delete process.env.EXPORTS_ENABLED;
  } else {
    process.env.EXPORTS_ENABLED = 'true';
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
  const testingModule = Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(SupabaseService)
    .useValue({ getClient: () => null });

  // SPEC-033: with openRouterEnabled the ai.module factory wires the real
  // OpenRouter adapters (HTTP mocked per-test via global fetch); the
  // returned jest.fn()s are unused placeholders.
  if (options.openRouterEnabled !== true) {
    testingModule
      .overrideProvider(TEXT_GENERATOR)
      .useValue({ generate: mockTextGenerate })
      .overrideProvider(IMAGE_GENERATOR)
      .useValue({ generate: mockImageGenerate });
  }

  const moduleRef = await testingModule
    .overrideProvider(BOOK_STORAGE)
    .useValue({
      upload: (path: string, data: Buffer): Promise<void> => {
        storedFiles.set(path, data);
        return Promise.resolve();
      },
      signedUrl: (path: string): Promise<string> =>
        Promise.resolve(`https://storage.test/${path}`),
      download: (path: string): Promise<Buffer> => {
        const data = storedFiles.get(path);

        if (!data) {
          return Promise.reject(
            new Error(`storage.test: no such file ${path}`),
          );
        }

        return Promise.resolve(data);
      },
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
