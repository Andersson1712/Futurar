import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretName, SecretProvider } from './secret-provider';

@Injectable()
export class EnvSecretProvider implements SecretProvider {
  constructor(private readonly configService: ConfigService) {}

  get(name: SecretName): Promise<string | undefined> {
    const value = this.configService.get<string>(name);

    return Promise.resolve(
      value && value.trim().length > 0 ? value : undefined,
    );
  }
}
