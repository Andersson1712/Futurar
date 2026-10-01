import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../app.setup';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { InMemoryProfileRepository } from './in-memory-profile.repository';
import { PROFILE_REPOSITORY } from './profile.repository';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

interface TestRequest {
  user?: { id: string };
}

describe('ProfilesController (SPEC-021)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [
        ProfilesService,
        { provide: PROFILE_REPOSITORY, useClass: InMemoryProfileRepository },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest<TestRequest>().user = {
            id: 'teacher-1',
          };
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

  it('creates, reads, updates and soft-deletes a profile', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/profiles')
      .send({ name: 'Ana', birthdate: '2016-04-12' })
      .expect(201);

    const profileId = (created.body as { id: string }).id;
    expect(
      (created.body as { settings: Record<string, unknown> }).settings,
    ).toMatchObject({
      bookStorySize: 'medium',
      bookAudience: 'child',
    });

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/profiles/${profileId}`)
      .send({ name: 'Ana María' })
      .expect(200);
    expect((updated.body as { name: string }).name).toBe('Ana María');

    await request(app.getHttpServer())
      .delete(`/api/v1/profiles/${profileId}`)
      .expect(204);

    const list = await request(app.getHttpServer())
      .get('/api/v1/profiles')
      .expect(200);
    expect(list.body).toEqual([]);
  });

  it('saves settings and returns book defaults', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/profiles')
      .send({ name: 'Ana' })
      .expect(201);
    const profileId = (created.body as { id: string }).id;

    const settings = await request(app.getHttpServer())
      .put(`/api/v1/profiles/${profileId}/settings`)
      .send({
        bookStorySize: 'large',
        bookAudience: 'teen',
        modules: { design: false },
        inputMode: 'touch',
      })
      .expect(200);

    expect(settings.body as Record<string, unknown>).toMatchObject({
      bookStorySize: 'large',
      bookAudience: 'teen',
      inputMode: 'touch',
      modules: { create: true, library: true, design: false },
    });
  });

  it('rejects invalid settings payloads', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/profiles')
      .send({ name: 'Ana' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .put(`/api/v1/profiles/${(created.body as { id: string }).id}/settings`)
      .send({ bookStorySize: 'huge', inputMode: 'telepathy' })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('404s for foreign profiles', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/profiles/missing')
      .expect(404);
  });
});
