import type { EncryptedPayload } from './crypto.service';

export const CREDENTIAL_REPOSITORY = Symbol('CREDENTIAL_REPOSITORY');

export const CREDENTIAL_PROVIDERS = ['gemini', 'openrouter'] as const;
export type CredentialProvider = (typeof CREDENTIAL_PROVIDERS)[number];
export type CredentialStatus = 'active' | 'revoked';

export interface CredentialMetadata {
  id: string;
  provider: CredentialProvider;
  keyHint: string;
  status: CredentialStatus;
  createdAt: Date;
  updatedAt: Date;
  rotatedAt?: Date;
}

export interface StoredCredential extends CredentialMetadata {
  ownerId: string;
  tenantId?: string;
  encrypted: EncryptedPayload;
}

export interface SaveCredentialInput {
  ownerId: string;
  tenantId?: string;
  provider: CredentialProvider;
  encrypted: EncryptedPayload;
  keyHint: string;
}

export interface CredentialRepository {
  save(input: SaveCredentialInput): Promise<CredentialMetadata>;
  findActive(
    ownerId: string,
    provider: CredentialProvider,
  ): Promise<StoredCredential | undefined>;
  list(ownerId: string): Promise<CredentialMetadata[]>;
  revoke(ownerId: string, provider: CredentialProvider): Promise<boolean>;
}
