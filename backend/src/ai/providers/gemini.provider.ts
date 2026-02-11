import { GoogleGenAI } from '@google/genai';
import { AIProvider, StoryGenerationConfig, StoryResult, STORY_SIZE_PAGES, StoryPage } from './ai-provider.interface';

export class GeminiProvider implements AIProvider {
    name = 'gemini';
    displayName = 'Google Gemini';
    private client: GoogleGenAI;

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    async generateStory(config: StoryGenerationConfig): Promise<StoryResult> {
        const numPages = STORY_SIZE_PAGES[config.storySize];

        const prompt = this.buildPrompt(config, numPages);

        const response = await this.client.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: {
                role: 'user',
                parts: [{ text: prompt }],
            },
        });

        const text = response.text || '';
        return this.parseStoryResponse(text, numPages);
    }

    private buildPrompt(config: StoryGenerationConfig, numPages: number): string {
        let prompt = `Eres un escritor experto de cuentos infantiles. Escribe un cuento completo de exactamente ${numPages} páginas.

CONFIGURACIÓN DEL CUENTO:
- Protagonista: ${config.protagonist}
- Escenario: ${config.scenery}
- Misión/Objetivo: ${config.mission}
- Estilo narrativo: ${config.style}
- Número de páginas: ${numPages}`;

        if (config.customStructure) {
            prompt += `

ESTRUCTURA PERSONALIZADA SOLICITADA:
${config.customStructure}`;
        }

        prompt += `

FORMATO DE RESPUESTA:
Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
    "title": "Título del cuento",
    "pages": [
        {
            "pageNumber": 1,
            "content": "Contenido de la página 1 (2-3 párrafos)",
            "imagePrompt": "Descripción para generar imagen de esta página"
        },
        ...
    ]
}

REGLAS:
1. Cada página debe tener 2-3 párrafos de contenido.
2. El cuento debe ser emocionante, tierno y apropiado para niños.
3. La misión debe completarse exitosamente al final.
4. Incluye descripciones vívidas y emociones.
5. El imagePrompt debe describir la escena visual de esa página.`;

        return prompt;
    }

    private parseStoryResponse(text: string, expectedPages: number): StoryResult {
        try {
            // Intentar extraer JSON de la respuesta
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No se encontró JSON en la respuesta');
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
            // Si falla el parseo, crear una estructura básica
            console.error('Error parsing Gemini response:', error);
            return {
                title: 'Cuento Generado',
                pages: [{
                    pageNumber: 1,
                    content: text,
                }],
                totalPages: 1,
            };
        }
    }

    async validateApiKey(): Promise<boolean> {
        try {
            await this.client.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: { role: 'user', parts: [{ text: 'Hola' }] },
            });
            return true;
        } catch {
            return false;
        }
    }
}
