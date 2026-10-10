import { validateEnv } from './env.validation';

const AI_ENABLED_ENV = {
  AI_ENDPOINTS_ENABLED: 'true',
  GEMINI_API_KEY: 'test-key',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_KEY: 'service-key',
};

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

    const enabled = validateEnv(AI_ENABLED_ENV);
    expect(enabled.AI_ENDPOINTS_ENABLED).toBe(true);
  });

  it('coerces SWAGGER_ENABLED', () => {
    expect(validateEnv({ SWAGGER_ENABLED: 'false' }).SWAGGER_ENABLED).toBe(
      false,
    );
  });

  it('accepts a valid LOG_LEVEL (SPEC-027)', () => {
    expect(validateEnv({ LOG_LEVEL: 'debug' }).LOG_LEVEL).toBe('debug');
    expect(validateEnv({}).LOG_LEVEL).toBeUndefined();
  });

  it('rejects an invalid LOG_LEVEL (SPEC-027)', () => {
    expect(() => validateEnv({ LOG_LEVEL: 'verbose' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects enabling AI endpoints without required secrets', () => {
    expect(() => validateEnv({ AI_ENDPOINTS_ENABLED: 'true' })).toThrow(
      /GEMINI_API_KEY/,
    );
  });

  it('rejects enabling AI endpoints without Supabase auth config', () => {
    expect(() =>
      validateEnv({
        AI_ENDPOINTS_ENABLED: 'true',
        GEMINI_API_KEY: 'test-key',
      }),
    ).toThrow(/SUPABASE_URL, SUPABASE_SERVICE_KEY/);
  });

  it('accepts enabling AI endpoints with the full config', () => {
    expect(validateEnv(AI_ENABLED_ENV).AI_ENDPOINTS_ENABLED).toBe(true);
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

  it('accepts openrouter as an AI_PROVIDER (SPEC-033D)', () => {
    expect(validateEnv({ AI_PROVIDER: 'openrouter' }).AI_PROVIDER).toBe(
      'openrouter',
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

  it('rejects invalid throttle values', () => {
    expect(() => validateEnv({ THROTTLE_LIMIT: '0' })).toThrow(
      /Invalid environment configuration/,
    );
    expect(() => validateEnv({ THROTTLE_TTL_MS: '10' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('rejects an invalid QUEUE_DRIVER', () => {
    expect(() => validateEnv({ QUEUE_DRIVER: 'rabbitmq' })).toThrow(
      /Invalid environment configuration/,
    );
  });

  it('requires REDIS_URL when QUEUE_DRIVER=bullmq', () => {
    expect(() => validateEnv({ QUEUE_DRIVER: 'bullmq' })).toThrow(/REDIS_URL/);

    const result = validateEnv({
      QUEUE_DRIVER: 'bullmq',
      REDIS_URL: 'redis://localhost:6379',
    });
    expect(result.QUEUE_DRIVER).toBe('bullmq');
  });

  it('requires Supabase when book images are enabled', () => {
    expect(() => validateEnv({ BOOK_IMAGES_ENABLED: 'true' })).toThrow(
      /SUPABASE_URL/,
    );

    const result = validateEnv({
      BOOK_IMAGES_ENABLED: 'true',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_KEY: 'service-key',
    });
    expect(result.BOOK_IMAGES_ENABLED).toBe(true);
  });

  it('rejects a too-short signed URL TTL', () => {
    expect(() =>
      validateEnv({ BOOK_IMAGE_SIGNED_URL_TTL_SECONDS: '10' }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('requires Supabase and a valid master key for credentials', () => {
    expect(() => validateEnv({ AI_CREDENTIALS_ENABLED: 'true' })).toThrow(
      /SUPABASE_URL/,
    );

    expect(() =>
      validateEnv({
        AI_CREDENTIALS_ENABLED: 'true',
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_KEY: 'service-key',
        AI_SECRETS_MASTER_KEY: 'not-a-32-byte-key',
      }),
    ).toThrow(/AI_SECRETS_MASTER_KEY/);

    const result = validateEnv({
      AI_CREDENTIALS_ENABLED: 'true',
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_KEY: 'service-key',
      AI_SECRETS_MASTER_KEY: Buffer.alloc(32, 7).toString('base64'),
    });
    expect(result.AI_CREDENTIALS_ENABLED).toBe(true);
  });
});
