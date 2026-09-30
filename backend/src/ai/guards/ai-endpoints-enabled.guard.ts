import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

/**
 * Containment guard (SPEC-001): the AI POST endpoints are disabled until the
 * backend owns provider keys and validation (SPEC-002/SPEC-003).
 * Enable only when the server-side key handling is in place.
 */
@Injectable()
export class AiEndpointsEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (process.env.AI_ENDPOINTS_ENABLED !== 'true') {
      throw new ServiceUnavailableException({ code: 'AI_ENDPOINTS_DISABLED' });
    }
    return true;
  }
}
