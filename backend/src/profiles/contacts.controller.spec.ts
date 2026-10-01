import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../app.setup';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { CONTACT_REPOSITORY } from './contacts.repository';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { InMemoryContactRepository } from './in-memory-contacts.repository';
import { InMemoryProfileRepository } from './in-memory-profile.repository';
import { PROFILE_REPOSITORY } from './profile.repository';
import { ProfilesService } from './profiles.service';

interface TestRequest {
  user?: { id: string };
}

describe('ContactsController (SPEC-022)', () => {
  let app: INestApplication<App>;
  let profiles: ProfilesService;
  let profileId: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [
        ContactsService,
        ProfilesService,
        { provide: PROFILE_REPOSITORY, useClass: InMemoryProfileRepository },
        { provide: CONTACT_REPOSITORY, useClass: InMemoryContactRepository },
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

    profiles = moduleRef.get(ProfilesService);
    const profile = await profiles.create('teacher-1', { name: 'Ana' });
    profileId = profile.id;
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates, lists, updates and deletes contacts', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/profiles/${profileId}/contacts`)
      .send({
        name: 'Beto',
        relationship: 'tío',
        dedicationReason: 'su cumple',
      })
      .expect(201);

    const contactId = (created.body as { id: string }).id;

    const list = await request(app.getHttpServer())
      .get(`/api/v1/profiles/${profileId}/contacts`)
      .expect(200);
    expect(list.body).toEqual([expect.objectContaining({ id: contactId })]);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/contacts/${contactId}`)
      .send({ relationship: 'padrino' })
      .expect(200);
    expect((updated.body as { relationship: string }).relationship).toBe(
      'padrino',
    );

    await request(app.getHttpServer())
      .delete(`/api/v1/contacts/${contactId}`)
      .expect(204);

    const afterDelete = await request(app.getHttpServer())
      .get(`/api/v1/profiles/${profileId}/contacts`)
      .expect(200);
    expect(afterDelete.body).toEqual([]);
  });

  it('rejects invalid payloads', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/profiles/${profileId}/contacts`)
      .send({ name: '', relationship: 'x'.repeat(41) })
      .expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('404s for missing profiles and contacts', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/profiles/missing/contacts')
      .expect(404);

    await request(app.getHttpServer())
      .patch('/api/v1/contacts/missing')
      .send({ name: 'Ana' })
      .expect(404);
  });
});
