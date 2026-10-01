import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export const AI_PROVIDERS = ['gemini'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

const NODE_ENVS = ['development', 'production', 'test'] as const;

export const QUEUE_DRIVERS = ['inline', 'bullmq'] as const;
export type QueueDriverOption = (typeof QUEUE_DRIVERS)[number];

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
};

const toNumber = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  return Number(value);
};

export class EnvironmentVariables {
  @IsOptional()
  @IsIn([...NODE_ENVS])
  NODE_ENV?: string;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  AI_ENDPOINTS_ENABLED?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  SWAGGER_ENABLED?: boolean;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1000)
  THROTTLE_TTL_MS?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT?: number;

  @IsOptional()
  @IsIn([...QUEUE_DRIVERS])
  QUEUE_DRIVER?: QueueDriverOption;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  REDIS_URL?: string;

  @IsOptional()
  @IsIn([...AI_PROVIDERS])
  AI_PROVIDER?: AiProvider;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  AI_MODEL_TEXT?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  AI_MODEL_IMAGE?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  AI_MODEL_TTS?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  AI_TTS_VOICE?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  AI_TTS_LANGUAGE?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  GEMINI_API_KEY?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  SUPABASE_URL?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_KEY?: string;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }

  if (validated.AI_ENDPOINTS_ENABLED === true) {
    const missing = (
      ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'] as const
    ).filter((name) => !validated[name]?.trim());

    if (missing.length > 0) {
      throw new Error(
        `AI_ENDPOINTS_ENABLED=true requires: ${missing.join(', ')}`,
      );
    }
  }

  if (validated.QUEUE_DRIVER === 'bullmq' && !validated.REDIS_URL?.trim()) {
    throw new Error('QUEUE_DRIVER=bullmq requires: REDIS_URL');
  }

  return validated;
}
