import { SecretName, SecretProvider } from './secret-provider';

export interface CredentialSecretProviderPorts {
  findActiveKey(tenantId: string): Promise<string | undefined>;
}

/**
 * Resolves tenant credentials first and falls back to the env provider
 * (dev/CI). The plaintext key never leaves this class.
 */
export class CredentialSecretProvider implements SecretProvider {
  constructor(
    private readonly credentials: CredentialSecretProviderPorts,
    private readonly fallback: SecretProvider,
  ) {}

  async get(name: SecretName, tenantId?: string): Promise<string | undefined> {
    if (name === 'GEMINI_API_KEY' && tenantId) {
      try {
        const stored = await this.credentials.findActiveKey(tenantId);

        if (stored) return stored;
      } catch {
        // Fall through to the env provider; failures are not leaked.
      }
    }

    return this.fallback.get(name, tenantId);
  }
}
