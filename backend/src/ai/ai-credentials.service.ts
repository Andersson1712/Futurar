import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiErrorException } from '../common/errors/ai-error.exception';
import { CREDENTIAL_REPOSITORY } from './secrets/credential.repository';
import type {
  CredentialMetadata,
  CredentialProvider,
  CredentialRepository,
} from './secrets/credential.repository';
import { CRYPTO_SERVICE } from './secrets/crypto.service';
import type { CryptoServiceLike } from './secrets/crypto.service';
import { CredentialMetadataDto } from './dto/credential.dto';

export const CREDENTIAL_PROVIDERS = ['gemini', 'openrouter'] as const;
export const API_KEY_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

@Injectable()
export class AiCredentialsService {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly repository: CredentialRepository,
    @Inject(CRYPTO_SERVICE) private readonly crypto: CryptoServiceLike,
    private readonly configService: ConfigService,
  ) {}

  async list(ownerId: string): Promise<CredentialMetadataDto[]> {
    this.assertEnabled();

    const credentials = await this.repository.list(ownerId);

    return credentials.map(toDto);
  }

  async save(
    ownerId: string,
    provider: string,
    apiKey: string,
  ): Promise<CredentialMetadataDto> {
    this.assertEnabled();
    const validProvider = this.parseProvider(provider);
    const normalized = apiKey.trim();

    if (!API_KEY_PATTERN.test(normalized)) {
      throw new AiErrorException(
        400,
        'VALIDATION_FAILED',
        'API key format is invalid',
      );
    }

    const encrypted = this.crypto!.encrypt(normalized);
    const metadata = await this.repository.save({
      ownerId,
      provider: validProvider,
      encrypted,
      keyHint: normalized.slice(-4),
    });

    return toDto(metadata);
  }

  async revoke(ownerId: string, provider: string): Promise<void> {
    this.assertEnabled();
    const validProvider = this.parseProvider(provider);
    const revoked = await this.repository.revoke(ownerId, validProvider);

    if (!revoked) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Credential not found');
    }
  }

  private assertEnabled(): void {
    if (
      this.configService.get<boolean>('AI_CREDENTIALS_ENABLED') !== true ||
      !this.crypto
    ) {
      throw new AiErrorException(
        503,
        'PROVIDER_UNAVAILABLE',
        'Credential management is disabled',
      );
    }
  }

  private parseProvider(provider: string): CredentialProvider {
    if (!(CREDENTIAL_PROVIDERS as readonly string[]).includes(provider)) {
      throw new AiErrorException(
        400,
        'VALIDATION_FAILED',
        'Unsupported provider',
      );
    }

    return provider as CredentialProvider;
  }
}

function toDto(metadata: CredentialMetadata): CredentialMetadataDto {
  return {
    provider: metadata.provider,
    keyHint: metadata.keyHint,
    status: metadata.status,
    createdAt: metadata.createdAt.toISOString(),
    updatedAt: metadata.updatedAt.toISOString(),
    rotatedAt: metadata.rotatedAt?.toISOString(),
  };
}
