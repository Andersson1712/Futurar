import { InMemoryActionRepository } from './in-memory-action.repository';
import { ActionsService } from './actions.service';
import { AiErrorException } from '../common/errors/ai-error.exception';

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

  it('rejects saves above max_enabled (SPEC-023B)', async () => {
    const { service } = buildService();
    const action = await service.create('teacher-1', {
      code: 'create',
      label: 'Crear Cuento',
    });
    const option = await service.createOption(action.id, 'teacher-1', {
      code: 'protagonist',
      label: 'Protagonista',
      maxEnabled: 2,
      maxPerPage: 5,
    });
    await service.createItem(option.id, 'teacher-1', { label: 'A' });
    await service.createItem(option.id, 'teacher-1', { label: 'B' });
    const c = await service.createItem(option.id, 'teacher-1', { label: 'C' });

    const error = await service
      .saveProfileItems('student-1', 'teacher-1', [
        { itemId: c.id, isEnabled: true },
      ])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiErrorException);
    expect(error).toMatchObject({ code: 'LIMIT_EXCEEDED' });
    expect((error as AiErrorException).getStatus()).toBe(422);

    await expect(
      service.saveProfileItems('student-1', 'teacher-1', [
        { itemId: c.id, isEnabled: false },
      ]),
    ).resolves.toEqual(expect.any(Array));
  });

  it('rejects saves above max_per_page per level (SPEC-023B)', async () => {
    const { service } = buildService();
    const action = await service.create('teacher-1', {
      code: 'create',
      label: 'Crear Cuento',
    });
    const option = await service.createOption(action.id, 'teacher-1', {
      code: 'protagonist',
      label: 'Protagonista',
      maxEnabled: 6,
      maxPerPage: 1,
    });
    const a = await service.createItem(option.id, 'teacher-1', { label: 'A' });
    const b = await service.createItem(option.id, 'teacher-1', { label: 'B' });

    const error = await service
      .saveProfileItems('student-1', 'teacher-1', [
        { itemId: a.id, isEnabled: true },
      ])
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiErrorException);
    expect(error).toMatchObject({ code: 'LIMIT_EXCEEDED' });
    expect((error as AiErrorException).getStatus()).toBe(422);

    await expect(
      service.saveProfileItems('student-1', 'teacher-1', [
        { itemId: b.id, isEnabled: false },
      ]),
    ).resolves.toEqual(expect.any(Array));
  });
});
