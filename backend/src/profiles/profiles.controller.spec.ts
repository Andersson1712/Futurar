import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../app.setup';
import { ACTION_REPOSITORY } from '../actions/action.repository';
import { ActionsService } from '../actions/actions.service';
import { InMemoryActionRepository } from '../actions/in-memory-action.repository';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { InMemoryProfileRepository } from './in-memory-profile.repository';
import type { ProfileRepository } from './profile.repository';
import { PROFILE_REPOSITORY } from './profile.repository';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

interface TestRequest {
  user?: { id: string };
}

describe('ProfilesController (SPEC-021)', () => {
  let app: INestApplication<App>;
  let actions: InMemoryActionRepository;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [
        ProfilesService,
        ActionsService,
        { provide: PROFILE_REPOSITORY, useClass: InMemoryProfileRepository },
        { provide: ACTION_REPOSITORY, useClass: InMemoryActionRepository },
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
    actions = moduleRef.get(ACTION_REPOSITORY);
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

  it('lists and saves per-profile actions and items', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/profiles')
      .send({ name: 'Ana' })
      .expect(201);
    const profileId = (created.body as { id: string }).id;

    const action = await actions.createAction('teacher-1', {
      code: 'create',
      label: 'Crear Cuento',
    });
    const option = await actions.createOption(action.id, 'teacher-1', {
      code: 'protagonist',
      label: 'Protagonista',
    });
    const item = await actions.createItem(option.id, 'teacher-1', {
      label: 'Un dragón',
      icon: 'pets',
    });

    const listedActions = await request(app.getHttpServer())
      .get(`/api/v1/profiles/${profileId}/actions`)
      .expect(200);
    expect(listedActions.body).toEqual([
      expect.objectContaining({ code: 'create', isEnabled: true }),
    ]);

    const savedActions = await request(app.getHttpServer())
      .put(`/api/v1/profiles/${profileId}/actions`)
      .send({ actions: [{ actionId: action.id, isEnabled: false }] })
      .expect(200);
    expect(savedActions.body).toEqual([
      expect.objectContaining({ code: 'create', isEnabled: false }),
    ]);

    const listedItems = await request(app.getHttpServer())
      .get(`/api/v1/profiles/${profileId}/items`)
      .expect(200);
    expect(listedItems.body).toEqual([
      expect.objectContaining({ itemId: item.id, isEnabled: true }),
    ]);

    const savedItems = await request(app.getHttpServer())
      .put(`/api/v1/profiles/${profileId}/items`)
      .send({ items: [{ itemId: item.id, isEnabled: false }] })
      .expect(200);
    expect(savedItems.body).toEqual([
      expect.objectContaining({ itemId: item.id, isEnabled: false }),
    ]);
  });

  it('rejects unknown catalog ids for a profile', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/profiles')
      .send({ name: 'Ana' })
      .expect(201);
    const profileId = (created.body as { id: string }).id;

    const response = await request(app.getHttpServer())
      .put(`/api/v1/profiles/${profileId}/items`)
      .send({
        items: [
          {
            itemId: '123e4567-e89b-42d3-a456-426614174000',
            isEnabled: true,
          },
        ],
      })
      .expect(404);

    expect(response.body).toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('ProfilesController public entry (SPEC-024)', () => {
  let app: INestApplication<App>;
  let repository: ProfileRepository;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [
        ProfilesService,
        ActionsService,
        { provide: PROFILE_REPOSITORY, useClass: InMemoryProfileRepository },
        { provide: ACTION_REPOSITORY, useClass: InMemoryActionRepository },
        { provide: SupabaseService, useValue: { getClient: () => null } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    repository = moduleRef.get(PROFILE_REPOSITORY);
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves GET /profiles/active without a Bearer token', async () => {
    await repository.create('teacher-1', { name: 'Beto', notes: 'Private' });

    const response = await request(app.getHttpServer())
      .get('/api/v1/profiles/active')
      .expect(200);

    const body = response.body as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ name: 'Beto' });
    expect(body[0]).not.toHaveProperty('notes');
  });

  it('keeps the teacher-scoped listing behind auth', async () => {
    await request(app.getHttpServer()).get('/api/v1/profiles').expect(401);
  });
});
