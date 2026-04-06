import { AIProvider, StoryGenerationConfig, StoryResult, STORY_SIZE_PAGES } from './ai-provider.interface';

export class TogetherProvider implements AIProvider {
    name = 'together';
    displayName = 'Together AI (Gratis tier)';
    private apiKey: string;
    private model: string;

    constructor(apiKey: string, model: string = 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo') {
        this.apiKey = apiKey;
        this.model = model;
    }

    async generateStory(config: StoryGenerationConfig): Promise<StoryResult> {
        const numPages = STORY_SIZE_PAGES[config.storySize];

        const prompt = this.buildPrompt(config, numPages);

        const response = await fetch('https://api.together.xyz/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'Eres un escritor experto de cuentos infantiles. Siempre respondes en formato JSON válido.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: 0.8,
                max_tokens: 8000,
            }),
        });

        const data = await response.json() as any;
        const text = data.choices?.[0]?.message?.content || '';
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

Responde SOLO con JSON:
{
    "title": "Título del cuento",
    "pages": [
        {"pageNumber": 1, "content": "Contenido de 2-3 párrafos", "imagePrompt": "Descripción visual"}
    ]
}

Crea exactamente ${numPages} páginas. El cuento debe ser emocionante y apropiado para niños.`;

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
            console.error('Error parsing Together response:', error);
            return {
                title: 'Cuento Generado',
                pages: [{ pageNumber: 1, content: text }],
                totalPages: 1,
            };
        }
    }

    async validateApiKey(): Promise<boolean> {
        try {
            const response = await fetch('https://api.together.xyz/v1/models', {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
