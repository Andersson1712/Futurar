import { BOOK_PROMPT_VERSION } from '../prompts/book/v1';
import type { BookGenerationCommand } from './book-generation.use-case';
import { PromptBuilderService } from './prompt-builder.service';

const BASE_COMMAND: BookGenerationCommand = {
  protagonist: 'Un dragón curioso',
  scenery: 'Un bosque mágico',
  mission: 'Encontrar la estrella perdida',
  style: 'Acuarela',
  storySize: 'small',
  userId: 'user-1',
};

describe('PromptBuilderService', () => {
  const builder = new PromptBuilderService();

  it('builds a versioned prompt with the synopsis and page guidance', () => {
    const result = builder.build(BASE_COMMAND);

    expect(result.version).toBe(BOOK_PROMPT_VERSION);
    expect(result.prompt).toContain('Un dragón curioso');
    expect(result.prompt).toContain('Un bosque mágico');
    expect(result.prompt).toContain('Encontrar la estrella perdida');
    expect(result.prompt).toContain('Acuarela');
    expect(result.prompt).toContain('Exactamente 5 páginas');
    expect(result.responseJsonSchema).toBeDefined();
  });

  it('uses size-specific page counts', () => {
    const medium = builder.build({ ...BASE_COMMAND, storySize: 'medium' });
    const large = builder.build({ ...BASE_COMMAND, storySize: 'large' });

    expect(medium.prompt).toContain('Exactamente 10 páginas');
    expect(large.prompt).toContain('Exactamente 15 páginas');
  });

  it('applies the child audience by default and other audiences when set', () => {
    const child = builder.build(BASE_COMMAND);
    const teen = builder.build({ ...BASE_COMMAND, audience: 'teen' });
    const adult = builder.build({ ...BASE_COMMAND, audience: 'adult' });

    expect(child.systemInstruction).toContain('niñas y niños de 5 a 8 años');
    expect(teen.systemInstruction).toContain('adolescentes de 9 a 14 años');
    expect(adult.systemInstruction).toContain('personas adultas');
  });

  it('includes the custom structure when provided and omits it when blank', () => {
    const withStructure = builder.build({
      ...BASE_COMMAND,
      customStructure: 'Comenzar en la luna',
    });
    const blankStructure = builder.build({
      ...BASE_COMMAND,
      customStructure: '   ',
    });

    expect(withStructure.prompt).toContain('Comenzar en la luna');
    expect(blankStructure.prompt).not.toContain('Estructura adicional');
  });

  it('includes the dedication with its position', () => {
    const start = builder.build({
      ...BASE_COMMAND,
      dedication: { to: 'Abuela', reason: 'su cumpleaños', position: 'start' },
    });
    const end = builder.build({
      ...BASE_COMMAND,
      dedication: { to: 'Abuela', reason: 'su cumpleaños', position: 'end' },
    });

    expect(start.prompt).toContain('dedicada a "Abuela"');
    expect(start.prompt).toContain('al comienzo');
    expect(end.prompt).toContain('al final');
  });

  it('asks for JSON-only output', () => {
    const result = builder.build(BASE_COMMAND);

    expect(result.systemInstruction).toContain('JSON válido');
    expect(result.prompt).toContain('Formato de respuesta (JSON');
  });
});
