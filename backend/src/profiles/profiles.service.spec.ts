import { AiErrorException } from '../common/errors/ai-error.exception';
import { InMemoryProfileRepository } from './in-memory-profile.repository';
import { ProfilesService } from './profiles.service';
import type { ProfileOptions } from './profile.repository';

function buildService() {
  const repository = new InMemoryProfileRepository();
  const service = new ProfilesService(repository);

  return { service, repository };
}

describe('ProfilesService (SPEC-021)', () => {
  it('creates and reads profiles scoped by teacher', async () => {
    const { service } = buildService();

    const created = await service.create('teacher-1', { name: 'Ana' });

    await expect(service.get(created.id, 'teacher-1')).resolves.toMatchObject({
      name: 'Ana',
    });
    await expect(service.get(created.id, 'teacher-2')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('merges settings without losing untouched values', async () => {
    const { service } = buildService();
    const created = await service.create('teacher-1', { name: 'Ana' });

    const settings = await service.saveSettings(created.id, 'teacher-1', {
      bookStorySize: 'large',
      modules: { library: false },
    });

    expect(settings).toMatchObject({
      scanInterval: 3000,
      bookStorySize: 'large',
      bookAudience: 'child',
      modules: { create: true, library: false, design: true },
    });
  });

  it('returns profile book defaults for generation', async () => {
    const { service } = buildService();
    const created = await service.create('teacher-1', { name: 'Ana' });
    await service.saveSettings(created.id, 'teacher-1', {
      bookStorySize: 'small',
      bookAudience: 'teen',
    });

    await expect(service.getBookDefaults(created.id)).resolves.toEqual({
      storySize: 'small',
      audience: 'teen',
    });
    await expect(service.getBookDefaults('missing')).resolves.toEqual({
      storySize: 'medium',
      audience: 'child',
    });
  });

  it('validates ownership before reading options', async () => {
    const { service, repository } = buildService();
    const created = await service.create('teacher-1', { name: 'Ana' });
    const options: ProfileOptions = {
      protagonists: [
        { id: 'p1', label: 'Un dragón', icon: 'pets', isEnabled: true },
      ],
      scenarios: [],
      missions: [],
      styles: [],
    };
    repository.seedOptions(created.id, options);

    await expect(service.listOptions(created.id, 'teacher-1')).resolves.toEqual(
      options,
    );
    await expect(
      service.listOptions(created.id, 'teacher-2'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects updates and deletes for foreign profiles', async () => {
    const { service } = buildService();
    const created = await service.create('teacher-1', { name: 'Ana' });

    const error = await service
      .update(created.id, 'teacher-2', { name: 'X' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiErrorException);

    await expect(
      service.deactivate(created.id, 'teacher-2'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
