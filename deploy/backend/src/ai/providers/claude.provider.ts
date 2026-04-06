import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, StoryGenerationConfig, StoryResult, STORY_SIZE_PAGES } from './ai-provider.interface';

export class ClaudeProvider implements AIProvider {
    name = 'claude';
    displayName = 'Anthropic Claude';
    private client: Anthropic;
    private model: string;

    constructor(apiKey: string, model: string = 'claude-3-5-haiku-latest') {
        this.client = new Anthropic({ apiKey });
        this.model = model;
    }

    async generateStory(config: StoryGenerationConfig): Promise<StoryResult> {
        const numPages = STORY_SIZE_PAGES[config.storySize];

        const prompt = this.buildPrompt(config, numPages);

        const response = await this.client.messages.create({
            model: this.model,
            max_tokens: 8000,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
        });

        const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
        return this.parseStoryResponse(text, numPages);
    }

    private buildPrompt(config: StoryGenerationConfig, numPages: number): string {
        let prompt = `Eres un escritor experto de cuentos infantiles. Escribe un cuento completo de exactamente ${numPages} páginas.

CONFIGURACIÓN DEL CUENTO:
- Protagonista: ${config.protagonist}
- Escenario: ${config.scenery}
- Misión/Objetivo: ${config.mission}
- Estilo narrativo: ${config.style}`;

        if (config.customStructure) {
            prompt += `

ESTRUCTURA PERSONALIZADA SOLICITADA:
${config.customStructure}`;
        }

        prompt += `

INSTRUCCIONES:
1. Responde ÚNICAMENTE con JSON válido
2. Cada página tiene 2-3 párrafos
3. El cuento debe ser emocionante y apropiado para niños
4. La misión se completa exitosamente al final

FORMATO JSON REQUERIDO:
{
    "title": "Título del cuento",
    "pages": [
        {
            "pageNumber": 1,
            "content": "Contenido de la página",
            "imagePrompt": "Descripción visual"
        }
    ]
}`;

        return prompt;
    }

    private parseStoryResponse(text: string, expectedPages: number): StoryResult {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            return {
                title: parsed.title || 'Cuento Sin Título',
                pages: parsed.pages?.map((p: any, index: number) => ({
                    pageNumber: p.pageNumber || index + 1,
                    content: p.content || '',
                    imagePrompt: p.imagePrompt,
                })) || [],
                totalPages: parsed.pages?.length || expectedPages,
            };
        } catch (error) {
            console.error('Error parsing Claude response:', error);
            return {
                title: 'Cuento Generado',
                pages: [{ pageNumber: 1, content: text }],
                totalPages: 1,
            };
        }
    }

    async validateApiKey(): Promise<boolean> {
        try {
            await this.client.messages.create({
                model: 'claude-3-5-haiku-latest',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Hola' }],
            });
            return true;
        } catch {
            return false;
        }
    }
}
