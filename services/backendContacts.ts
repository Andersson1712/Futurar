import { apiFetch } from './backendApi';

export interface ProfileContactPayload {
  id: string;
  profileId: string;
  name: string;
  relationship: string;
  dedicationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactInput {
  name: string;
  relationship: string;
  dedicationReason?: string;
}

export async function listProfileContacts(
  profileId: string,
): Promise<ProfileContactPayload[]> {
  return apiFetch<ProfileContactPayload[]>(
    `/api/v1/profiles/${encodeURIComponent(profileId)}/contacts`,
  );
}

export async function createProfileContact(
  profileId: string,
  input: ContactInput,
): Promise<ProfileContactPayload> {
  return apiFetch<ProfileContactPayload>(
    `/api/v1/profiles/${encodeURIComponent(profileId)}/contacts`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function updateProfileContact(
  contactId: string,
  patch: Partial<ContactInput>,
): Promise<ProfileContactPayload> {
  return apiFetch<ProfileContactPayload>(
    `/api/v1/contacts/${encodeURIComponent(contactId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
}

export async function deleteProfileContact(contactId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/contacts/${encodeURIComponent(contactId)}`, {
    method: 'DELETE',
  });
}
