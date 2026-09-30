import { ServiceUnavailableException } from '@nestjs/common';
import { AiEndpointsEnabledGuard } from './ai-endpoints-enabled.guard';

describe('AiEndpointsEnabledGuard', () => {
  const original = process.env.AI_ENDPOINTS_ENABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.AI_ENDPOINTS_ENABLED;
    } else {
      process.env.AI_ENDPOINTS_ENABLED = original;
    }
  });

  it('blocks the request when AI_ENDPOINTS_ENABLED is not "true"', () => {
    delete process.env.AI_ENDPOINTS_ENABLED;
    const guard = new AiEndpointsEnabledGuard();

    expect(() => guard.canActivate()).toThrow(ServiceUnavailableException);
  });

  it('blocks the request when AI_ENDPOINTS_ENABLED is any other value', () => {
    process.env.AI_ENDPOINTS_ENABLED = 'false';
    const guard = new AiEndpointsEnabledGuard();

    expect(() => guard.canActivate()).toThrow(ServiceUnavailableException);
  });

  it('allows the request when AI_ENDPOINTS_ENABLED is "true"', () => {
    process.env.AI_ENDPOINTS_ENABLED = 'true';
    const guard = new AiEndpointsEnabledGuard();

    expect(guard.canActivate()).toBe(true);
  });
});
