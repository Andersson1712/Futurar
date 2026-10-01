import { AiErrorException } from '../common/errors/ai-error.exception';
import { InMemoryActionRepository } from '../actions/in-memory-action.repository';
import { ActionsService } from '../actions/actions.service';
import { InMemoryProfileRepository } from './in-memory-profile.repository';
import { ProfilesService } from './profiles.service';

function buildService() {
  const repository = new InMemoryProfileRepository();
  const actions = new InMemoryActionRepository();
  const service = new ProfilesService(
    repository,
    actions,
    new ActionsService(actions),
  );

  return { service, repository, actions };
}

async function seedCatalog(actions: InMemoryActionRepository) {
  const action = await actions.createAction('teacher-1', {
    code: 'create',
    label: 'Crear Cuento',
  });
  await actions.createAction('teacher-1', {
    code: 'library',
    label: 'Mi Biblioteca',
  });
  const option = await actions.createOption(action.id, 'teacher-1', {
    code: 'protagonist',
    label: 'Protagonista',
  });

  await actions.createItem(option.id, 'teacher-1', {
    label: 'Un dragón',
    icon: 'pets',
  });

  return { action, option };
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

  it('serves profile options from the catalog adapter', async () => {
    const { service, actions } = buildService();
    await seedCatalog(actions);
    const created = await service.create('teacher-1', { name: 'Ana' });

    await expect(
      service.listOptions(created.id, 'teacher-1'),
    ).resolves.toMatchObject({
      protagonists: [
        expect.objectContaining({ label: 'Un dragón', icon: 'pets' }),
      ],
      scenarios: [],
      missions: [],
      styles: [],
    });
    await expect(
      service.listOptions(created.id, 'teacher-2'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('mirrors modules into profile actions and saves profile items', async () => {
    const { service, actions } = buildService();
    const { action, option } = await seedCatalog(actions);
    const created = await service.create('teacher-1', { name: 'Ana' });

    await service.saveSettings(created.id, 'teacher-1', {
      modules: { library: false },
    });

    const profileActions = await service.listProfileActions(
      created.id,
      'teacher-1',
    );
    expect(profileActions).toHaveLength(2);
    expect(profileActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: action.id,
          code: 'create',
          isEnabled: true,
        }),
        expect.objectContaining({ code: 'library', isEnabled: false }),
      ]),
    );

    const items = await service.listProfileItems(created.id, 'teacher-1');
    expect(items).toHaveLength(1);

    const saved = await service.saveProfileItems(created.id, 'teacher-1', {
      items: [{ itemId: items[0].itemId, isEnabled: false }],
    });
    expect(saved[0].isEnabled).toBe(false);

    await expect(
      service.saveProfileItems(created.id, 'teacher-2', {
        items: [{ itemId: items[0].itemId, isEnabled: true }],
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const enabledItem = await actions.createItem(option.id, 'teacher-1', {
      label: 'Animales',
    });
    await expect(
      service.saveProfileItems(created.id, 'teacher-1', {
        items: [{ itemId: enabledItem.id, isEnabled: true }],
      }),
    ).resolves.toHaveLength(2);
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
