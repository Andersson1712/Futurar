import Groq from 'groq-sdk';
import { AIProvider, StoryGenerationConfig, StoryResult, STORY_SIZE_PAGES } from './ai-provider.interface';

export class GroqProvider implements AIProvider {
    name = 'groq';
    displayName = 'Groq (Llama 3.1 - Gratis)';
    private client: Groq;
    private model: string;

    constructor(apiKey: string, model: string = 'llama-3.1-70b-versatile') {
        this.client = new Groq({ apiKey });
        this.model = model;
    }

    async generateStory(config: StoryGenerationConfig): Promise<StoryResult> {
        const numPages = STORY_SIZE_PAGES[config.storySize];

        const prompt = this.buildPrompt(config, numPages);

        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: 'Eres un escritor experto de cuentos infantiles. Siempre respondes en formato JSON válido sin explicaciones adicionales.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            temperature: 0.8,
            max_tokens: 8000,
        });

        const text = response.choices[0]?.message?.content || '';
        return this.parseStoryResponse(text, numPages);
    }

    private buildPrompt(config: StoryGenerationConfig, numPages: number): string {
        let prompt = `Escribe un cuento infantil de exactamente ${numPages} páginas.

CONFIGURACIÓN:
- Protagonista: ${config.protagonist}
- Escenario: ${config.scenery}
- Misión: ${config.mission}
- Estilo: ${config.style}`;

        if (config.customStructure) {
            prompt += `

ESTRUCTURA PERSONALIZADA:
${config.customStructure}`;
        }

        prompt += `

Responde SOLO con este JSON (sin texto adicional):
{
    "title": "Título del cuento",
    "pages": [
        {
            "pageNumber": 1,
            "content": "Contenido de 2-3 párrafos",
            "imagePrompt": "Descripción visual de la escena"
        }
    ]
}

Crea exactamente ${numPages} páginas. El cuento debe ser emocionante, tierno y apropiado para niños.`;

        return prompt;
    }

    private parseStoryResponse(text: string, expectedPages: number): StoryResult {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
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
            console.error('Error parsing Groq response:', error);
            return {
                title: 'Cuento Generado',
                pages: [{ pageNumber: 1, content: text }],
                totalPages: 1,
            };
        }
    }

    async validateApiKey(): Promise<boolean> {
        try {
            await this.client.chat.completions.create({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: 'Hola' }],
                max_tokens: 5,
            });
            return true;
        } catch {
            return false;
        }
    }
}
