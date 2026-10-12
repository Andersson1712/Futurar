import { InMemoryActionRepository } from './in-memory-action.repository';

async function seedCatalog(repository: InMemoryActionRepository) {
  const action = await repository.createAction('teacher-1', {
    code: 'create',
    label: 'Crear Cuento',
  });
  const option = await repository.createOption(action.id, 'teacher-1', {
    code: 'protagonist',
    label: 'Protagonista',
  });
  const item = await repository.createItem(option.id, 'teacher-1', {
    label: 'Un dragón',
    icon: 'pets',
  });
  const hidden = await repository.createItem(option.id, 'teacher-1', {
    label: 'Nivel 2',
    level: 2,
  });

  return { action, option, item, hidden };
}

describe('InMemoryActionRepository (SPEC-023)', () => {
  it('creates and lists catalog rows scoped by teacher', async () => {
    const repository = new InMemoryActionRepository();
    const { action, item } = await seedCatalog(repository);

    await expect(repository.listActions('teacher-1')).resolves.toHaveLength(1);
    await expect(repository.listActions('teacher-2')).resolves.toEqual([]);

    const options = await repository.listOptions(action.id, 'teacher-1');
    expect(options).toHaveLength(1);
    expect(options?.[0].items.map((entry) => entry.label)).toEqual([
      'Un dragón',
      'Nivel 2',
    ]);

    await expect(
      repository.listOptions(action.id, 'teacher-2'),
    ).resolves.toBeUndefined();
    await expect(
      repository.createOption(action.id, 'teacher-2', {
        code: 'style',
        label: 'Estilo',
      }),
    ).resolves.toBeUndefined();
    await expect(
      repository.updateOption(options?.[0].id ?? '', 'teacher-2', {
        label: 'Hack',
      }),
    ).resolves.toBeUndefined();
    await expect(repository.deactivateItem(item.id, 'teacher-2')).resolves.toBe(
      false,
    );
  });

  it('updates and deactivates catalog rows', async () => {
    const repository = new InMemoryActionRepository();
    const { action, option, item } = await seedCatalog(repository);

    const updated = await repository.updateAction(action.id, 'teacher-1', {
      label: 'Crear',
      sortOrder: 5,
    });
    expect(updated).toMatchObject({ label: 'Crear', sortOrder: 5 });

    await expect(
      repository.deactivateAction(action.id, 'teacher-1'),
    ).resolves.toBe(true);
    await expect(
      repository.deactivateAction(action.id, 'teacher-1'),
    ).resolves.toBe(false);

    const updatedOption = await repository.updateOption(
      option.id,
      'teacher-1',
      { maxEnabled: 6 },
    );
    expect(updatedOption?.maxEnabled).toBe(6);

    const updatedItem = await repository.updateItem(item.id, 'teacher-1', {
      label: 'Un dragón curioso',
      sortOrder: 9,
    });
    expect(updatedItem).toMatchObject({
      label: 'Un dragón curioso',
      sortOrder: 9,
    });
  });

  it('seeds profile defaults and syncs modules into profile actions', async () => {
    const repository = new InMemoryActionRepository();
    const { action, item } = await seedCatalog(repository);
    await repository.createAction('teacher-1', {
      code: 'library',
      label: 'Biblioteca',
    });

    await repository.seedProfileDefaults('student-1', 'teacher-1');

    const actions = await repository.getProfileActions(
      'student-1',
      'teacher-1',
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actionId: action.id, isEnabled: true }),
        expect.objectContaining({ code: 'library', isEnabled: true }),
      ]),
    );

    await repository.syncProfileActions('student-1', 'teacher-1', {
      create: true,
      library: false,
      design: true,
    });

    const synced = await repository.getProfileActions('student-1', 'teacher-1');
    expect(synced).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'library', isEnabled: false }),
      ]),
    );

    const items = await repository.getProfileItems('student-1', 'teacher-1');
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ itemId: item.id, isEnabled: true });
  });

  it('saves profile items and serves enabled options across levels', async () => {
    const repository = new InMemoryActionRepository();
    const { item, hidden } = await seedCatalog(repository);
    await repository.seedProfileDefaults('student-1', 'teacher-1');

    const saved = await repository.saveProfileItems('student-1', 'teacher-1', [
      { itemId: item.id, isEnabled: false },
      { itemId: hidden.id, isEnabled: false },
    ]);
    expect(saved?.[0].isEnabled).toBe(false);

    const options = await repository.getStudentOptions('student-1');
    expect(options.protagonists).toEqual([]);
    expect(options.scenarios).toEqual([]);

    const defaults = await repository.getStudentOptions('student-2');
    expect(defaults.protagonists).toEqual([
      expect.objectContaining({
        label: 'Un dragón',
        icon: 'pets',
        level: 1,
        sortOrder: 1,
      }),
      expect.objectContaining({ label: 'Nivel 2', level: 2 }),
    ]);

    await expect(
      repository.saveProfileItems('student-1', 'teacher-2', [
        { itemId: item.id, isEnabled: true },
      ]),
    ).resolves.toBeUndefined();
  });

  it('only derives student options from the create action (SPEC-023B parity)', async () => {
    const repository = new InMemoryActionRepository();
    const { option } = await seedCatalog(repository);
    const library = await repository.createAction('teacher-1', {
      code: 'library',
      label: 'Biblioteca',
    });
    const libraryOption = await repository.createOption(
      library.id,
      'teacher-1',
      {
        code: 'protagonist',
        label: 'Protagonista biblioteca',
      },
    );
    await repository.createItem(libraryOption?.id ?? option.id, 'teacher-1', {
      label: 'No debería aparecer',
    });

    const options = await repository.getStudentOptions('student-1');

    expect(options.protagonists.map((entry) => entry.label)).toEqual([
      'Un dragón',
      'Nivel 2',
    ]);
  });
});

describe('InMemoryActionRepository.ensureTeacherCatalog (SPEC-023C)', () => {
  it('seeds the full introductory catalog for a new teacher on first profile', async () => {
    const repository = new InMemoryActionRepository();

    await repository.seedProfileDefaults('profile-1', 'new-teacher');

    const actions = await repository.listActions('new-teacher');
    expect(actions.map((action) => action.code)).toEqual([
      'create',
      'library',
      'design',
    ]);

    const create = actions.find((action) => action.code === 'create');
    const options = await repository.listOptions(
      create?.id ?? '',
      'new-teacher',
    );
    expect(options?.map((option) => option.code)).toEqual([
      'protagonist',
      'scenario',
      'mission',
      'style',
    ]);

    const items = await repository.getProfileItems('profile-1', 'new-teacher');
    expect(items).toHaveLength(79);

    const studentOptions = await repository.getStudentOptions('profile-1');
    expect(studentOptions.protagonists.length).toBeGreaterThan(0);
    expect(studentOptions.scenarios.length).toBeGreaterThan(0);
    expect(studentOptions.missions.length).toBeGreaterThan(0);
    expect(studentOptions.styles.length).toBeGreaterThan(0);
  });

  it('inserts zero rows on the second profile for the same teacher', async () => {
    const repository = new InMemoryActionRepository();

    await repository.seedProfileDefaults('profile-1', 'new-teacher');
    const actionsBefore = await repository.listActions('new-teacher');
    const itemsBefore = await repository.getProfileItems(
      'profile-1',
      'new-teacher',
    );

    await repository.seedProfileDefaults('profile-2', 'new-teacher');

    const actionsAfter = await repository.listActions('new-teacher');
    const itemsAfter = await repository.getProfileItems(
      'profile-2',
      'new-teacher',
    );
    expect(actionsAfter).toHaveLength(actionsBefore.length);
    expect(itemsAfter).toHaveLength(itemsBefore.length);
  });

  it('leaves an existing teacher catalog untouched', async () => {
    const repository = new InMemoryActionRepository();
    await seedCatalog(repository);

    await repository.seedProfileDefaults('student-1', 'teacher-1');

    await expect(repository.listActions('teacher-1')).resolves.toHaveLength(1);
    const items = await repository.getProfileItems('student-1', 'teacher-1');
    expect(items).toHaveLength(2);
  });

  it('seeds exactly maxEnabled enabled items per option (SPEC-023C quota)', async () => {
    const repository = new InMemoryActionRepository();

    await repository.seedProfileDefaults('profile-1', 'new-teacher');

    const items = await repository.getProfileItems('profile-1', 'new-teacher');
    expect(items).toHaveLength(79);

    const byOption = new Map<string, typeof items>();

    for (const item of items) {
      const list = byOption.get(item.optionId) ?? [];

      list.push(item);
      byOption.set(item.optionId, list);
    }

    expect(byOption.size).toBe(4);

    for (const entries of byOption.values()) {
      const enabled = entries.filter((entry) => entry.isEnabled);
      const ranked = [...entries].sort(
        (a, b) =>
          a.level - b.level ||
          a.sortOrder - b.sortOrder ||
          a.label.localeCompare(b.label),
      );

      // Intro options default to maxEnabled 4; every other item is
      // explicitly disabled so later saves start within quota.
      expect(enabled).toHaveLength(4);
      expect(entries).toHaveLength(ranked.length);
      expect(new Set(enabled.map((entry) => entry.itemId))).toEqual(
        new Set(ranked.slice(0, 4).map((entry) => entry.itemId)),
      );
    }

    expect(items.filter((item) => !item.isEnabled)).toHaveLength(79 - 4 * 4);
  });
});
