import { Inject, Injectable } from '@nestjs/common';
import { CREDENTIAL_REPOSITORY } from './credential.repository';
import type {
  CredentialProvider,
  CredentialRepository,
} from './credential.repository';
import { CRYPTO_SERVICE } from './crypto.service';
import type { CryptoServiceLike } from './crypto.service';

/**
 * Decrypts the active credential for a tenant and provider. Returns
 * undefined when credentials are disabled or the tenant has no stored key.
 */
@Injectable()
export class CredentialResolver {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly repository: CredentialRepository,
    @Inject(CRYPTO_SERVICE) private readonly crypto: CryptoServiceLike,
  ) {}

  async findActiveKey(
    tenantId: string,
    provider: CredentialProvider,
  ): Promise<string | undefined> {
    if (!this.crypto) return undefined;

    const stored = await this.repository.findActive(tenantId, provider);

    if (!stored) return undefined;

    return this.crypto.decrypt(stored.encrypted);
  }
}
