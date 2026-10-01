import { InMemoryContactRepository } from './in-memory-contacts.repository';
import { InMemoryProfileRepository } from './in-memory-profile.repository';
import { ContactsService } from './contacts.service';

async function buildService() {
  const profiles = new InMemoryProfileRepository();
  const contacts = new InMemoryContactRepository();
  const profile = await profiles.create('teacher-1', { name: 'Ana' });

  return {
    service: new ContactsService(contacts, profiles),
    profile,
    profiles,
    contacts,
  };
}

describe('ContactsService (SPEC-022)', () => {
  it('creates and lists contacts for an owned profile', async () => {
    const { service, profile } = await buildService();

    const created = await service.create(profile.id, 'teacher-1', {
      name: 'Beto',
      relationship: 'tío',
      dedicationReason: 'su cumpleaños',
    });

    expect(created).toMatchObject({
      profileId: profile.id,
      name: 'Beto',
      dedicationReason: 'su cumpleaños',
    });

    await expect(service.list(profile.id, 'teacher-1')).resolves.toEqual([
      expect.objectContaining({ id: created.id }),
    ]);
  });

  it('404s for foreign or missing profiles', async () => {
    const { service, profile } = await buildService();

    await expect(service.list(profile.id, 'teacher-2')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      service.create('missing', 'teacher-1', {
        name: 'Ana',
        relationship: 'mamá',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('updates and removes contacts only for the owner', async () => {
    const { service, profile } = await buildService();
    const contact = await service.create(profile.id, 'teacher-1', {
      name: 'Beto',
      relationship: 'tío',
    });

    const updated = await service.update(contact.id, 'teacher-1', {
      relationship: 'padrino',
    });
    expect(updated.relationship).toBe('padrino');

    await expect(
      service.update(contact.id, 'teacher-2', { name: 'Hack' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.remove(contact.id, 'teacher-2')).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
    await expect(service.remove('missing', 'teacher-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });

    await expect(
      service.remove(contact.id, 'teacher-1'),
    ).resolves.toBeUndefined();
  });
});
