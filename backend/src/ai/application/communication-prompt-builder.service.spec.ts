import { COMMUNICATION_PROMPT_VERSION } from '../prompts/communication/v1';
import { CommunicationPromptBuilderService } from './communication-prompt-builder.service';

describe('CommunicationPromptBuilderService', () => {
  const builder = new CommunicationPromptBuilderService();

  it('builds a versioned prompt with the requested cell count', () => {
    const prompt = builder.build({
      kind: 'feelings',
      topic: 'Cómo me siento hoy',
      style: 'Pictogramas',
      cellCount: 6,
      audience: 'child',
      userId: 'user-1',
    });

    expect(prompt.version).toBe(COMMUNICATION_PROMPT_VERSION);
    expect(prompt.prompt).toContain('Cómo me siento hoy');
    expect(prompt.prompt).toContain('6');
    expect(prompt.systemInstruction).toContain('es-AR');
    expect(prompt.responseJsonSchema).toMatchObject({
      required: ['title', 'cells'],
    });
  });

  it('defaults the audience to child', () => {
    const prompt = builder.build({
      kind: 'help',
      topic: 'Necesito ayuda',
      style: 'Pictogramas',
      cellCount: 4,
      userId: 'user-1',
    });

    expect(prompt.systemInstruction).toContain('5 a 8 años');
  });
});
