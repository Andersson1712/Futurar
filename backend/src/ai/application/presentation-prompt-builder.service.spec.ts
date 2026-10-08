import { PRESENTATION_PROMPT_VERSION } from '../prompts/presentation/v1';
import { PresentationPromptBuilderService } from './presentation-prompt-builder.service';

describe('PresentationPromptBuilderService', () => {
  const builder = new PresentationPromptBuilderService();

  it('builds a versioned prompt with the requested slide count', () => {
    const prompt = builder.build({
      topic: 'Los dinosaurios',
      style: 'Acuarela',
      slideCount: 8,
      audience: 'child',
      userId: 'user-1',
    });

    expect(prompt.version).toBe(PRESENTATION_PROMPT_VERSION);
    expect(prompt.prompt).toContain('Los dinosaurios');
    expect(prompt.prompt).toContain('8');
    expect(prompt.systemInstruction).toContain('es-AR');
    expect(prompt.responseJsonSchema).toMatchObject({
      required: ['title', 'slides'],
    });
  });

  it('defaults the audience to child', () => {
    const prompt = builder.build({
      topic: 'Los dinosaurios',
      style: 'Acuarela',
      slideCount: 5,
      userId: 'user-1',
    });

    expect(prompt.systemInstruction).toContain('5 a 8 años');
  });
});
