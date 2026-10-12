import { InMemoryContactRepository } from './in-memory-contacts.repository';

describe('InMemoryContactRepository (SPEC-022)', () => {
  it('creates, lists sorted, updates and removes contacts', async () => {
    const repository = new InMemoryContactRepository();

    const beto = await repository.create('student-1', {
      name: 'Beto',
      relationship: 'tío',
      dedicationReason: 'su cumpleaños',
    });
    await repository.create('student-1', {
      name: 'Ana',
      relationship: 'mamá',
    });

    const list = await repository.list('student-1');
    expect(list.map((contact) => contact.name)).toEqual(['Ana', 'Beto']);

    const updated = await repository.update(beto.id, {
      relationship: 'padrino',
    });
    expect(updated).toMatchObject({
      relationship: 'padrino',
      dedicationReason: 'su cumpleaños',
    });

    await expect(repository.remove(beto.id)).resolves.toBe(true);
    await expect(repository.list('student-1')).resolves.toHaveLength(1);
  });

  it('keeps contacts scoped by profile', async () => {
    const repository = new InMemoryContactRepository();
    await repository.create('student-1', { name: 'Ana', relationship: 'mamá' });
    await repository.create('student-2', { name: 'Beto', relationship: 'tío' });

    const list = await repository.list('student-2');

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ profileId: 'student-2', name: 'Beto' });
  });

  it('returns undefined for missing contacts and ignores undefined patches', async () => {
    const repository = new InMemoryContactRepository();
    const contact = await repository.create('student-1', {
      name: 'Ana',
      relationship: 'mamá',
    });

    await expect(repository.findById('missing')).resolves.toBeUndefined();
    await expect(
      repository.update('missing', { name: 'X' }),
    ).resolves.toBeUndefined();
    await expect(repository.remove('missing')).resolves.toBe(false);

    const updated = await repository.update(contact.id, { name: undefined });
    expect(updated?.name).toBe('Ana');
  });
});
