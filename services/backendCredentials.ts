import { apiFetch } from './backendApi';

export interface CredentialMetadata {
  provider: string;
  keyHint: string;
  status: 'active' | 'revoked';
  createdAt: string;
  updatedAt: string;
  rotatedAt?: string;
}

export async function listCredentials(): Promise<CredentialMetadata[]> {
  return apiFetch<CredentialMetadata[]>('/api/v1/ai/credentials');
}

export async function saveCredential(
  provider: string,
  apiKey: string,
): Promise<CredentialMetadata> {
  return apiFetch<CredentialMetadata>(
    `/api/v1/ai/credentials/${encodeURIComponent(provider)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    },
  );
}

export async function revokeCredential(provider: string): Promise<void> {
  return apiFetch<void>(
    `/api/v1/ai/credentials/${encodeURIComponent(provider)}`,
    { method: 'DELETE' },
  );
}
