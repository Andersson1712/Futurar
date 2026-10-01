import { InMemoryActionRepository } from './in-memory-action.repository';
import { ActionsService } from './actions.service';

function buildService() {
  const repository = new InMemoryActionRepository();
  const service = new ActionsService(repository);

  return { service, repository };
}

describe('ActionsService (SPEC-023)', () => {
  it('creates and lists actions, options and items', async () => {
    const { service } = buildService();

    const action = await service.create('teacher-1', {
      code: 'create',
      label: 'Crear Cuento',
    });
    const option = await service.createOption(action.id, 'teacher-1', {
      code: 'protagonist',
      label: 'Protagonista',
    });
    const item = await service.createItem(option.id, 'teacher-1', {
      label: 'Un dragón',
      icon: 'pets',
    });

    await expect(service.list('teacher-1')).resolves.toHaveLength(1);
    await expect(service.list('teacher-2')).resolves.toEqual([]);
    await expect(service.listOptions(action.id, 'teacher-1')).resolves.toEqual([
      expect.objectContaining({ id: option.id }),
    ]);
    expect(item).toMatchObject({ label: 'Un dragón', level: 1 });
  });

  it('404s for foreign or missing catalog rows', async () => {
    const { service } = buildService();
    const action = await service.create('teacher-1', {
      code: 'create',
      label: 'Crear Cuento',
    });

    await expect(
      service.update(action.id, 'teacher-2', { label: 'Hack' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.deactivate(action.id, 'teacher-2'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.listOptions(action.id, 'teacher-2'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.createOption(action.id, 'teacher-2', {
        code: 'style',
        label: 'Estilo',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.updateOption('missing', 'teacher-1', { label: 'X' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.createItem('missing', 'teacher-1', { label: 'X' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.updateItem('missing', 'teacher-1', { label: 'X' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      service.deactivateItem('missing', 'teacher-1'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deactivates catalog rows', async () => {
    const { service } = buildService();
    const action = await service.create('teacher-1', {
      code: 'create',
      label: 'Crear Cuento',
    });
    const option = await service.createOption(action.id, 'teacher-1', {
      code: 'protagonist',
      label: 'Protagonista',
    });
    const item = await service.createItem(option.id, 'teacher-1', {
      label: 'Un dragón',
    });

    await expect(
      service.deactivateItem(item.id, 'teacher-1'),
    ).resolves.toBeUndefined();
    await expect(
      service.deactivateItem(item.id, 'teacher-1'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await expect(
      service.deactivateOption(option.id, 'teacher-1'),
    ).resolves.toBeUndefined();

    const updated = await service.update(action.id, 'teacher-1', {
      label: 'Crear',
    });
    expect(updated.label).toBe('Crear');

    await expect(
      service.deactivate(action.id, 'teacher-1'),
    ).resolves.toBeUndefined();
  });
});
