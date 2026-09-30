import { CanActivate, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiErrorException } from '../../common/errors/ai-error.exception';

/**
 * Containment guard (SPEC-001): AI endpoints stay disabled until the
 * server-owned pipeline is fully wired (SPEC-004/005/006).
 */
@Injectable()
export class AiEndpointsEnabledGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    if (this.configService.get<boolean>('AI_ENDPOINTS_ENABLED') !== true) {
      throw new AiErrorException(
        503,
        'AI_ENDPOINTS_DISABLED',
        'AI endpoints are disabled',
      );
    }

    return true;
  }
}
