import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../app.setup';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { ACTION_REPOSITORY } from './action.repository';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { InMemoryActionRepository } from './in-memory-action.repository';

interface TestRequest {
  user?: { id: string };
}

describe('ActionsController (SPEC-023)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ActionsController],
      providers: [
        ActionsService,
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
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates the catalog and lists it', async () => {
    const action = await request(app.getHttpServer())
      .post('/api/v1/actions')
      .send({ code: 'create', label: 'Crear Cuento', icon: 'auto_stories' })
      .expect(201);
    const actionId = (action.body as { id: string }).id;

    const option = await request(app.getHttpServer())
      .post(`/api/v1/actions/${actionId}/options`)
      .send({ code: 'protagonist', label: 'Protagonista', maxEnabled: 4 })
      .expect(201);
    const optionId = (option.body as { id: string }).id;

    const item = await request(app.getHttpServer())
      .post(`/api/v1/options/${optionId}/items`)
      .send({ label: 'Un dragón', icon: 'pets' })
      .expect(201);
    const itemId = (item.body as { id: string }).id;

    const actions = await request(app.getHttpServer())
      .get('/api/v1/actions')
      .expect(200);
    expect(actions.body).toEqual([
      expect.objectContaining({ id: actionId, code: 'create' }),
    ]);

    const options = await request(app.getHttpServer())
      .get(`/api/v1/actions/${actionId}/options`)
      .expect(200);
    expect(options.body).toEqual([
      expect.objectContaining({
        id: optionId,
        items: [expect.objectContaining({ id: itemId })],
      }),
    ]);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/items/${itemId}`)
      .send({ label: 'Un dragón curioso', level: 1 })
      .expect(200);
    expect(updated.body).toMatchObject({ label: 'Un dragón curioso' });

    await request(app.getHttpServer())
      .delete(`/api/v1/items/${itemId}`)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/api/v1/options/${optionId}`)
      .expect(204);
    await request(app.getHttpServer())
      .delete(`/api/v1/actions/${actionId}`)
      .expect(204);
  });

  it('validates codes and payloads', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/actions')
      .send({ code: 'Create!', label: '' })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });

    const invalidItem = await request(app.getHttpServer())
      .post('/api/v1/options/missing/items')
      .send({ label: 'x'.repeat(81) })
      .expect(400);
    expect(invalidItem.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('404s for foreign or missing catalog rows', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/actions/missing')
      .send({ label: 'X' })
      .expect(404);
    await request(app.getHttpServer())
      .delete('/api/v1/options/missing')
      .expect(404);
    await request(app.getHttpServer())
      .patch('/api/v1/items/missing')
      .send({ label: 'X' })
      .expect(404);
  });
});
