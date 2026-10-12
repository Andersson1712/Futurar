import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server } from '../test/msw/server';
import { SAMPLE_CONTACT } from '../test/msw/handlers';
import {
  createProfileContact,
  deleteProfileContact,
  listProfileContacts,
  updateProfileContact,
} from './backendContacts';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'token-1' } },
      }),
      refreshSession: vi.fn(),
    },
  },
}));

describe('backendContacts (SPEC-022)', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('lists the contacts of a profile', async () => {
    await expect(listProfileContacts('student-1')).resolves.toEqual([
      SAMPLE_CONTACT,
    ]);
  });

  it('creates a contact', async () => {
    const contact = await createProfileContact('student-1', {
      name: 'Beto',
      relationship: 'tío',
      dedicationReason: 'su cumpleaños',
    });

    expect(contact).toMatchObject({ id: 'contact-2', name: 'Beto' });
  });

  it('updates a contact', async () => {
    const contact = await updateProfileContact('contact-1', {
      relationship: 'padrino',
    });

    expect(contact.relationship).toBe('padrino');
  });

  it('deletes a contact', async () => {
    await expect(deleteProfileContact('contact-1')).resolves.toBeUndefined();
  });
});
