import { DESIGN_PROMPT_VERSION } from '../prompts/design/v1';
import type { DesignGenerationCommand } from './design-generation.use-case';
import { DesignPromptBuilderService } from './design-prompt-builder.service';

const BASE_COMMAND: DesignGenerationCommand = {
  occasion: 'birthday',
  message: 'Fiesta de cumple el sabado a las 17',
  style: 'Acuarela',
  userId: 'user-1',
};

describe('DesignPromptBuilderService', () => {
  const builder = new DesignPromptBuilderService();

  it('builds a versioned image-first prompt with the flyer brief', () => {
    const result = builder.build(BASE_COMMAND);

    expect(result.version).toBe(DESIGN_PROMPT_VERSION);
    expect(result.prompt).toContain('Fiesta de cumple el sabado a las 17');
    expect(result.prompt).toContain('Acuarela');
    expect(result.prompt).toContain('140');
    expect(result.responseJsonSchema).toBeDefined();
  });

  it('applies the child audience by default and other audiences when set', () => {
    const child = builder.build(BASE_COMMAND);
    const teen = builder.build({ ...BASE_COMMAND, audience: 'teen' });
    const adult = builder.build({ ...BASE_COMMAND, audience: 'adult' });

    expect(child.systemInstruction).toContain('niñas y niños de 5 a 8 años');
    expect(teen.systemInstruction).toContain('adolescentes de 9 a 14 años');
    expect(adult.systemInstruction).toContain('personas adultas');
  });

  it('asks for JSON-only es-AR output with an English image prompt', () => {
    const result = builder.build(BASE_COMMAND);

    expect(result.systemInstruction).toContain('JSON válido');
    expect(result.prompt).toContain('Formato de respuesta (JSON');
    expect(result.prompt).toContain('imagePrompt');
  });
});
