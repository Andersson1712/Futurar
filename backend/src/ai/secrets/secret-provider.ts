import type { CredentialProvider } from './credential.repository';

export type SecretName = 'GEMINI_API_KEY' | 'OPENROUTER_API_KEY';

export const SECRET_PROVIDERS: Partial<Record<SecretName, CredentialProvider>> =
  {
    GEMINI_API_KEY: 'gemini',
    OPENROUTER_API_KEY: 'openrouter',
  };

export interface SecretProvider {
  get(name: SecretName, tenantId?: string): Promise<string | undefined>;
}
