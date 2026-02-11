import OpenAI from 'openai';
import { AIProvider, StoryGenerationConfig, StoryResult, STORY_SIZE_PAGES } from './ai-provider.interface';

export class OpenAIProvider implements AIProvider {
    name = 'openai';
    displayName = 'OpenAI (GPT-4)';
    private client: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string = 'gpt-4o-mini') {
        this.client = new OpenAI({ apiKey });
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
                    content: 'Eres un escritor experto de cuentos infantiles. Siempre respondes en formato JSON válido.',
                },
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.8,
        });

        const text = response.choices[0]?.message?.content || '';
        return this.parseStoryResponse(text, numPages);
    }

    private buildPrompt(config: StoryGenerationConfig, numPages: number): string {
        let prompt = `Escribe un cuento infantil completo de exactamente ${numPages} páginas.

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

Responde con este JSON:
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

Crea exactamente ${numPages} páginas. El cuento debe ser emocionante y apropiado para niños.`;

        return prompt;
    }

    private parseStoryResponse(text: string, expectedPages: number): StoryResult {
        try {
            const parsed = JSON.parse(text);

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
            console.error('Error parsing OpenAI response:', error);
            return {
                title: 'Cuento Generado',
                pages: [{ pageNumber: 1, content: text }],
                totalPages: 1,
            };
        }
    }

    async validateApiKey(): Promise<boolean> {
        try {
            await this.client.models.list();
            return true;
        } catch {
            return false;
        }
    }

    async generateImage(prompt: string, style: string = 'vivid'): Promise<string> {
        try {
            const response = await this.client.images.generate({
                model: 'dall-e-3',
                prompt: `${prompt}. Estilo: ${style}. Alta calidad, apropiado para niños.`,
                n: 1,
                size: '1024x1024',
                response_format: 'b64_json', // Usamos base64 para evitar URLs firmadas que expiran pronto
                style: 'vivid', // vivid or natural
            });

            const b64 = response?.data?.[0]?.b64_json;
            if (!b64) throw new Error('No image data returned from OpenAI');

            return `data:image/png;base64,${b64}`;
        } catch (error) {
            console.error('Error generating image with DALL-E 3:', error);
            throw error;
        }
    }
}
