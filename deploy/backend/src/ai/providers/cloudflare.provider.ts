import { AIProvider, StoryGenerationConfig, StoryResult, STORY_SIZE_PAGES } from './ai-provider.interface';

export class CloudflareProvider implements AIProvider {
    name = 'cloudflare';
    displayName = 'Cloudflare AI (Gratis)';
    private accountId: string;
    private apiToken: string;
    private model: string;

    constructor(accountId: string, apiToken: string, model: string = '@cf/meta/llama-3.1-8b-instruct') {
        this.accountId = accountId;
        this.apiToken = apiToken;
        this.model = model;
    }

    async generateStory(config: StoryGenerationConfig): Promise<StoryResult> {
        const numPages = STORY_SIZE_PAGES[config.storySize];

        const prompt = this.buildPrompt(config, numPages);

        const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.model}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
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
                }),
            }
        );

        const data = await response.json() as any;
        const text = data.result?.response || '';
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
    "title": "Título",
    "pages": [
        {"pageNumber": 1, "content": "Contenido", "imagePrompt": "Descripción visual"}
    ]
}

Crea ${numPages} páginas. Cuento emocionante y para niños.`;

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
            console.error('Error parsing Cloudflare response:', error);
            return {
                title: 'Cuento Generado',
                pages: [{ pageNumber: 1, content: text }],
                totalPages: 1,
            };
        }
    }

    async validateApiKey(): Promise<boolean> {
        try {
            const response = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messages: [{ role: 'user', content: 'Hola' }],
                    }),
                }
            );
            return response.ok;
        } catch {
            return false;
        }
    }
}
