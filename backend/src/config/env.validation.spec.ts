import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  it('accepts a minimal configuration and coerces PORT', () => {
    const result = validateEnv({ PORT: '3001' });

    expect(result.PORT).toBe(3001);
    expect(result.AI_ENDPOINTS_ENABLED).toBeUndefined();
  });

  it('coerces boolean strings, including "false"', () => {
    expect(
      validateEnv({ AI_ENDPOINTS_ENABLED: 'false' }).AI_ENDPOINTS_ENABLED,
    ).toBe(false);

    const enabled = validateEnv({
      AI_ENDPOINTS_ENABLED: 'true',
      GEMINI_API_KEY: 'test-key',
    });
    expect(enabled.AI_ENDPOINTS_ENABLED).toBe(true);
  });

  it('rejects enabling AI endpoints without GEMINI_API_KEY', () => {
    expect(() => validateEnv({ AI_ENDPOINTS_ENABLED: 'true' })).toThrow(
      /GEMINI_API_KEY/,
    );
  });

  it('rejects an invalid PORT', () => {
    expect(() => validateEnv({ PORT: 'not-a-port' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects a PORT outside the valid range', () => {
    expect(() => validateEnv({ PORT: '70000' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects an unsupported AI_PROVIDER', () => {
    expect(() => validateEnv({ AI_PROVIDER: 'openai' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects an empty model value', () => {
    expect(() => validateEnv({ AI_MODEL_TEXT: '' })).toThrow(
      /Invalid environment configuration/,
    );
  });
});
