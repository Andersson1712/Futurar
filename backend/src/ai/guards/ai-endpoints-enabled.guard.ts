import { CanActivate, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiErrorException } from '../../common/errors/ai-error.exception';

/**
 * Reads a boolean env flag tolerantly: validated boot config carries real
 * booleans, while harnesses that assign `process.env` after the
 * ConfigModule import-time snapshot are seen as raw `'true'` strings
 * through the ConfigService `process.env` fallback. Without this, E2E
 * suites fail with 503 in clean environments (no local `.env` file)
 * while passing on dev machines. Same pattern as `isDesignFlagEnabled`.
 */
function isFlagEnabled(value: unknown): boolean {
  return value === true || value === 'true' || value === '1';
}

/**
 * Containment guard (SPEC-001): AI endpoints stay disabled until the
 * server-owned pipeline is fully wired (SPEC-004/005/006).
 */
@Injectable()
export class AiEndpointsEnabledGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    if (!isFlagEnabled(this.configService.get('AI_ENDPOINTS_ENABLED'))) {
      throw new AiErrorException(
        503,
        'AI_ENDPOINTS_DISABLED',
        'AI endpoints are disabled',
      );
    }

    return true;
  }
}
