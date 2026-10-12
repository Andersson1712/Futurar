import {
  SECRET_PROVIDERS,
  SecretName,
  SecretProvider,
} from './secret-provider';
import type { CredentialProvider } from './credential.repository';

export interface CredentialSecretProviderPorts {
  findActiveKey(
    tenantId: string,
    provider: CredentialProvider,
  ): Promise<string | undefined>;
}

/**
 * Resolves tenant credentials first and falls back to the env provider
 * (dev/CI). The plaintext key never leaves this class. A stored but
 * unreadable key fails loudly; only a missing/revoked row falls back.
 */
export class CredentialSecretProvider implements SecretProvider {
  constructor(
    private readonly credentials: CredentialSecretProviderPorts,
    private readonly fallback: SecretProvider,
  ) {}

  async get(name: SecretName, tenantId?: string): Promise<string | undefined> {
    const provider = SECRET_PROVIDERS[name];

    if (tenantId) {
      const stored = await this.credentials.findActiveKey(tenantId, provider);

      if (stored) return stored;
    }

    return this.fallback.get(name, tenantId);
  }
}
