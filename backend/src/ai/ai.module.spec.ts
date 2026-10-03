import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { validateEnv } from '../config/env.validation';
import { fakePinoLogger } from '../observability/fake-pino-logger';
import { AiModule } from './ai.module';
import { GeminiImageAdapter } from './infrastructure/gemini/gemini-image.adapter';
import { GeminiTextAdapter } from './infrastructure/gemini/gemini-text.adapter';
import { GeminiTtsAdapter } from './infrastructure/gemini/gemini-tts.adapter';
import { GeminiClientProvider } from './infrastructure/gemini/gemini-client.provider';
import {
  IMAGE_GENERATOR,
  SECRET_PROVIDER,
  TEXT_GENERATOR,
  TTS_GENERATOR,
} from './tokens';

describe('AiModule', () => {
  it('resolves the generator ports, secrets and client provider without an API key', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          validate: validateEnv,
        }),
        AiModule,
      ],
    })
      .overrideProvider(PinoLogger)
      .useValue(fakePinoLogger())
      .compile();

    expect(moduleRef.get(TEXT_GENERATOR)).toBeInstanceOf(GeminiTextAdapter);
    expect(moduleRef.get(IMAGE_GENERATOR)).toBeInstanceOf(GeminiImageAdapter);
    expect(moduleRef.get(TTS_GENERATOR)).toBeInstanceOf(GeminiTtsAdapter);
    expect(moduleRef.get(SECRET_PROVIDER)).toBeDefined();
    expect(moduleRef.get(GeminiClientProvider)).toBeInstanceOf(
      GeminiClientProvider,
    );

    await moduleRef.close();
  });
});
