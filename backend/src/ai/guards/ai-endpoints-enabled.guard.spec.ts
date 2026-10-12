import { ConfigService } from '@nestjs/config';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import { AiEndpointsEnabledGuard } from './ai-endpoints-enabled.guard';

function buildGuard(enabled?: unknown): AiEndpointsEnabledGuard {
  const config = enabled === undefined ? {} : { AI_ENDPOINTS_ENABLED: enabled };

  return new AiEndpointsEnabledGuard(new ConfigService(config));
}

describe('AiEndpointsEnabledGuard', () => {
  it('blocks the request when AI_ENDPOINTS_ENABLED is not configured', () => {
    expect(() => buildGuard().canActivate()).toThrow(AiErrorException);
  });

  it('blocks the request when AI_ENDPOINTS_ENABLED is false', () => {
    expect(() => buildGuard(false).canActivate()).toThrow(AiErrorException);
  });

  it('returns 503 with AI_ENDPOINTS_DISABLED when blocked', () => {
    try {
      buildGuard(false).canActivate();
      fail('Expected guard to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AiErrorException);
      expect((error as AiErrorException).getStatus()).toBe(503);
      expect((error as AiErrorException).code).toBe('AI_ENDPOINTS_DISABLED');
    }
  });

  it('allows the request when AI_ENDPOINTS_ENABLED is true', () => {
    expect(buildGuard(true).canActivate()).toBe(true);
  });

  it('allows raw string flags from the ConfigService env fallback', () => {
    expect(buildGuard('true').canActivate()).toBe(true);
    expect(buildGuard('1').canActivate()).toBe(true);
  });

  it('blocks falsy raw string flags', () => {
    expect(() => buildGuard('false').canActivate()).toThrow(AiErrorException);
    expect(() => buildGuard('0').canActivate()).toThrow(AiErrorException);
  });
});
