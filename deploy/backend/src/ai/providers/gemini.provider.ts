import { GoogleGenAI, Type, Schema } from '@google/genai';
import { AIProvider, StoryGenerationConfig, StoryResult, STORY_SIZE_PAGES, StoryPage } from './ai-provider.interface';

export class GeminiProvider implements AIProvider {
    name = 'gemini';
    displayName = 'Google Gemini';
    private client: GoogleGenAI;
    private model: string;
    private apiKey: string;

    constructor(apiKey: string, model: string = 'gemini-2.0-flash') {
        this.apiKey = apiKey;
        this.client = new GoogleGenAI({ apiKey });
        this.model = model;
    }

    async generateStory(config: StoryGenerationConfig): Promise<StoryResult> {
        const numPages = STORY_SIZE_PAGES[config.storySize];

        const prompt = this.buildPrompt(config, numPages);

        const response = await this.client.models.generateContent({
            model: this.model,
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
    async generateImage(prompt: string, style: string = 'vivid'): Promise<string> {
        try {
            // El modelo de imagen preferido viene configurado desde el frontend a través de this.model
            let imageModel = this.model || 'imagen-4.0-fast-generate-001';

            // Forzar actualización de modelos legados si el frontend en caché los envía
            if (imageModel.includes('gemini-3.1-flash-image') || imageModel.includes('gemini-2.0-flash-preview-image')) {
                imageModel = 'imagen-4.0-fast-generate-001';
            }

            console.log(`🎨 Generando imagen con Gemini/Imagen (${imageModel})... Style: ${style}`);

            const fullPrompt = `Generate an illustration for a children's story. Style: ${style}. Scene: ${prompt}. Colorful, friendly, appropriate for children. No text in the image.`;

            if (imageModel.startsWith('imagen-')) {
                // Para la familia Imagen 4, usamos generateImages
                const response = await this.client.models.generateImages({
                    model: imageModel,
                    prompt: fullPrompt,
                    config: {
                        numberOfImages: 1,
                        aspectRatio: '1:1',
                        personGeneration: 'ALLOW_ADULT' as any, // As string or enum
                    }
                });

                const generated = response.generatedImages?.[0];
                if (!generated?.image?.imageBytes) {
                    throw new Error('No image bytes returned from Imagen API');
                }
                // imageBytes es en base64 en la respuesta JSON o en buffer. El SDK de TS lo expone como string codificado en base64 en algunos contextos, o buffer. 
                // En el doc de Node dice: const buffer = Buffer.from(generated.image.imageBytes, "base64");
                // Así que devolveremos ese string directamente
                return `data:image/png;base64,${generated.image.imageBytes}`;
            } else {
                // Para las variantes experimentales de Gemini Flash (como gemini-3.1-flash-image-preview)
                const response = await this.client.models.generateContent({
                    model: imageModel,
                    contents: fullPrompt,
                });

                const parts = response.candidates?.[0]?.content?.parts || [];
                const imagePart = (parts as any[]).find((p: any) => p.inlineData?.data);

                if (!imagePart?.inlineData?.data) {
                    throw new Error('No image data returned from Gemini');
                }

                const mimeType = imagePart.inlineData.mimeType || 'image/png';
                return `data:${mimeType};base64,${imagePart.inlineData.data}`;
            }

        } catch (error) {
            console.error(`Error generating image with ${this.model}:`, error);
            throw error;
        }
    }
}
