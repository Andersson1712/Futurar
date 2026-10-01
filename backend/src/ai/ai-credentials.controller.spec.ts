import { randomBytes } from 'node:crypto';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../app.setup';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { AiCredentialsController } from './ai-credentials.controller';
import { AiCredentialsService } from './ai-credentials.service';
import { InMemoryCredentialRepository } from './secrets/in-memory-credential.repository';
import { CryptoService } from './secrets/crypto.service';
import { CREDENTIAL_REPOSITORY } from './secrets/credential.repository';
import { CRYPTO_SERVICE } from './secrets/crypto.service';

const API_KEY = 'AIzaSyTestKey1234567890abcdefg';

interface TestRequest {
  user?: { id: string };
}

describe('AiCredentialsController (SPEC-020)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AiCredentialsController],
      providers: [
        AiCredentialsService,
        { provide: ConfigService, useValue: new ConfigService({ AI_CREDENTIALS_ENABLED: true }) },
        { provide: CREDENTIAL_REPOSITORY, useClass: InMemoryCredentialRepository },
        { provide: CRYPTO_SERVICE, useValue: new CryptoService(randomBytes(32)) },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest<TestRequest>().user = { id: 'teacher-1' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('saves a key and never returns it', async () => {
    const response = await request(app.getHttpServer())
      .put('/api/v1/ai/credentials/gemini')
      .send({ apiKey: API_KEY })
      .expect(200);

    expect(response.body).toMatchObject({ provider: 'gemini', status: 'active' });
    expect(JSON.stringify(response.body)).not.toContain(API_KEY);
  });

  it('lists metadata only and revokes with 204', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/ai/credentials/gemini')
      .send({ apiKey: API_KEY })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get('/api/v1/ai/credentials')
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(API_KEY);

    await request(app.getHttpServer())
      .delete('/api/v1/ai/credentials/gemini')
      .expect(204);

    const after = await request(app.getHttpServer())
      .get('/api/v1/ai/credentials')
      .expect(200);
    expect(after.body[0].status).toBe('revoked');
  });

  it('rejects invalid payloads and providers', async () => {
    const invalid = await request(app.getHttpServer())
      .put('/api/v1/ai/credentials/gemini')
      .send({ apiKey: 'short' })
      .expect(400);
    expect(invalid.body).toMatchObject({ code: 'VALIDATION_FAILED' });

    await request(app.getHttpServer())
      .put('/api/v1/ai/credentials/openai')
      .send({ apiKey: API_KEY })
      .expect(400);
  });
});
