import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from '../config/env.validation';
import { AiModule } from './ai.module';
import { GeminiImageAdapter } from './infrastructure/gemini/gemini-image.adapter';
import { GeminiTextAdapter } from './infrastructure/gemini/gemini-text.adapter';
import { GeminiTtsAdapter } from './infrastructure/gemini/gemini-tts.adapter';
import {
  GEMINI_CLIENT,
  IMAGE_GENERATOR,
  SECRET_PROVIDER,
  TEXT_GENERATOR,
  TTS_GENERATOR,
} from './tokens';

describe('AiModule', () => {
  it('resolves the generator ports, secrets and client without an API key', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: validateEnv,
        }),
        AiModule,
      ],
    }).compile();

    expect(moduleRef.get(TEXT_GENERATOR)).toBeInstanceOf(GeminiTextAdapter);
    expect(moduleRef.get(IMAGE_GENERATOR)).toBeInstanceOf(GeminiImageAdapter);
    expect(moduleRef.get(TTS_GENERATOR)).toBeInstanceOf(GeminiTtsAdapter);
    expect(moduleRef.get(SECRET_PROVIDER)).toBeDefined();
    expect(moduleRef.get(GEMINI_CLIENT)).toBeNull();

    await moduleRef.close();
  });
});
