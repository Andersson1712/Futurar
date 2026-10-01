import { InMemoryProfileRepository } from './in-memory-profile.repository';
import { DEFAULT_PROFILE_SETTINGS, ProfileOptions } from './profile.repository';

const OPTIONS: ProfileOptions = {
  protagonists: [
    { id: 'p1', label: 'Un dragón', icon: 'pets', isEnabled: true },
  ],
  scenarios: [],
  missions: [],
  styles: [],
};

describe('InMemoryProfileRepository (SPEC-021)', () => {
  it('creates, lists and scopes profiles by teacher', async () => {
    const repository = new InMemoryProfileRepository();

    const created = await repository.create('teacher-1', { name: 'Ana' });
    await repository.create('teacher-2', { name: 'Beto' });

    expect(created.settings).toEqual(DEFAULT_PROFILE_SETTINGS);

    const list = await repository.list('teacher-1', true);
    expect(list.map((profile) => profile.name)).toEqual(['Ana']);
    await expect(
      repository.findById(created.id, 'teacher-2'),
    ).resolves.toBeUndefined();
  });

  it('updates and soft-deletes profiles', async () => {
    const repository = new InMemoryProfileRepository();
    const created = await repository.create('teacher-1', { name: 'Ana' });

    const updated = await repository.update(created.id, 'teacher-1', {
      name: 'Ana María',
      birthdate: '2016-04-12',
    });
    expect(updated).toMatchObject({
      name: 'Ana María',
      birthdate: '2016-04-12',
    });

    await expect(repository.deactivate(created.id, 'teacher-1')).resolves.toBe(
      true,
    );
    await expect(repository.list('teacher-1', true)).resolves.toEqual([]);
    await expect(repository.list('teacher-1', false)).resolves.toHaveLength(1);
    await expect(repository.deactivate(created.id, 'teacher-1')).resolves.toBe(
      false,
    );
  });

  it('merges and stores settings', async () => {
    const repository = new InMemoryProfileRepository();
    const created = await repository.create('teacher-1', { name: 'Ana' });

    await repository.saveSettings(created.id, {
      ...DEFAULT_PROFILE_SETTINGS,
      bookStorySize: 'large',
      modules: { create: true, library: false, design: true },
    });

    const settings = await repository.getSettings(created.id);
    expect(settings).toMatchObject({
      bookStorySize: 'large',
      modules: { create: true, library: false, design: true },
    });
  });

  it('returns seeded options', async () => {
    const repository = new InMemoryProfileRepository();
    const created = await repository.create('teacher-1', { name: 'Ana' });
    repository.seedOptions(created.id, OPTIONS);

    await expect(repository.listOptions(created.id)).resolves.toEqual(OPTIONS);
  });
});
