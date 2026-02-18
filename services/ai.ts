/**
 * Servicio unificado de IA para Futurar
 * Soporta: Gemini, OpenAI, Claude, Groq, Cloudflare, Together AI
 * Updated: 2026-02-17
 */

import { GoogleGenAI } from "@google/genai";
import { getRandomImage } from '../utils/images';

// Tipos
export interface StoryPage {
    pageNumber: number;
    content: string;
    imagePrompt?: string;
}

export interface StoryResult {
    title: string;
    pages: StoryPage[];
    totalPages: number;
}

export interface AIConfig {
    activeProvider: string;
    activeImageProvider?: string;
    apiKeys: Record<string, string>;
    preferredModel?: string;
}

// Mapeo de tamaño a capítulos/páginas
const STORY_SIZE_CONFIG = {
    short: { chapters: 3, wordsPerChapter: 150 },
    medium: { chapters: 5, wordsPerChapter: 300 },
    long: { chapters: 8, wordsPerChapter: 500 },
    // Backward compatibility
    small: { chapters: 3, wordsPerChapter: 150 },
    large: { chapters: 8, wordsPerChapter: 500 },
};

/**
 * Obtiene la configuración de IA guardada
 */
export const getStoredAIConfig = (): AIConfig | null => {
    try {
        const stored = localStorage.getItem('futurar_ai_config');
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Error reading AI config:', error);
    }
    return null;
};

/**
 * Obtiene la API key según el proveedor activo
 */
const getApiKey = (provider: string): string | null => {
    const config = getStoredAIConfig();

    if (config?.apiKeys) {
        switch (provider) {
            case 'gemini':
                return config.apiKeys.gemini || null;
            case 'openai':
                return config.apiKeys.openai || null;
            case 'claude':
                return config.apiKeys.claude || null;
            case 'groq':
                return config.apiKeys.groq || null;
            case 'together':
                return config.apiKeys.together || null;
            case 'freepik':
                return config.apiKeys.freepik || import.meta.env.VITE_FREEPIK_API_KEY || null;
            default:
                return null;
        }
    }

    // Fallback para Gemini
    if (provider === 'gemini') {
        return localStorage.getItem('futurar_gemini_key') || import.meta.env.VITE_GEMINI_API_KEY || null;
    }

    return null;
};

/**
 * Construye el prompt para la generación de cuentos
 */
const buildStoryPrompt = (
    protagonist: string,
    scenery: string,
    mission: string,
    style: string,
    sizeConfig: { chapters: number; wordsPerChapter: number },
    customStructure?: string,
    targetAudience: 'child' | 'adolescent' | 'adult' | 'all' = 'child'
): string => {

    // Configuración de audiencia
    let audienceInstruction = "El cuento debe ser apropiado para niños: emocionante, tierno y educativo.";
    let toneInstruction = "Usa un lenguaje sencillo y claro.";

    if (targetAudience === 'adolescent') {
        audienceInstruction = "El cuento está dirigido a adolescentes. Puede incluir temas más complejos, acción dinámica y conflictos emocionales apropiados.";
        toneInstruction = "Usa un tono más maduro, pero accesible. Puedes usar vocabulario un poco más avanzado.";
    } else if (targetAudience === 'adult') {
        audienceInstruction = "El cuento está dirigido a adultos (aunque apto para todo público). Debe tener profundidad temática y narrativa.";
        toneInstruction = "Usa un estilo literario rico, con metáforas y descripciones elaboradas.";
    }

    // Configuración de estilo narrativo basado en estilo visual
    let styleNarrativeInstruction = "";
    const styleLower = style.toLowerCase();
    if (styleLower.includes('acuarela') || styleLower.includes('watercolor')) {
        styleNarrativeInstruction = "Usa un tono suave, poético y soñador, como una pintura en acuarela.";
    } else if (styleLower.includes('cartoon') || styleLower.includes('animado')) {
        styleNarrativeInstruction = "Usa un tono enérgico, divertido y dinámico, como una caricatura.";
    } else if (styleLower.includes('realista') || styleLower.includes('realistic')) {
        styleNarrativeInstruction = "Usa descripciones detalladas y tangibles, haciendo que el mundo se sienta real y vivo.";
    } else if (styleLower.includes('pixel') || styleLower.includes('8-bit')) {
        styleNarrativeInstruction = "Usa una narrativa directa y aventurera, evocando la sensación de un videojuego retro.";
    }

    let prompt = `Actúa como un autor galardonado de cuentos.
    
INSTRUCCIÓN PRINCIPAL:
Escribe un cuento creativo y envolvente.
La PRIMERA LÍNEA de tu respuesta debe ser el TÍTULO del cuento (creativo, llamativo y sin etiquetas como "Título:").
Después del título, deja una línea en blanco y comienza la historia.

SINOPSIS: 
- Protagonista: ${protagonist}
- Escenario: ${scenery}  
- Misión/Objetivo: ${mission}
- Estilo visual: ${style}
- Público Objetivo: ${targetAudience}

REQUISITOS OBLIGATORIOS:
1. NO USES MARKDOWN en el título o contenido (nada de **, ##, etc). Solo texto plano.
2. Escribe EXACTAMENTE ${sizeConfig.chapters} capítulos.
3. Inicia cada capítulo con: "CAPÍTULO [NÚMERO]: [TÍTULO CREATIVO]"
4. Cada capítulo debe tener APROXIMADAMENTE ${sizeConfig.wordsPerChapter} palabras.
5. Incluye diálogos entre personajes para dar vida a la historia.
6. Usa descripciones sensoriales (colores, sonidos, olores, texturas).
7. ${audienceInstruction}
8. ${toneInstruction}
9. ${styleNarrativeInstruction}
10. Incluye una moraleja o conclusión satisfactoria al final.
11. La misión debe completarse exitosamente.`;

    if (customStructure && customStructure.trim()) {
        prompt += `

INSTRUCCIONES ADICIONALES:
${customStructure}`;
    }

    prompt += `

Genera el cuento completo ahora. Comienza directamente con el TÍTULO y luego "CAPÍTULO 1:".`;

    return prompt;
};

/**
 * Genera cuento con Gemini
 */
const generateWithGemini = async (
    apiKey: string,
    prompt: string,
    model: string = 'gemini-2.0-flash'
): Promise<string> => {
    console.log(`🔵 Usando Gemini para generación (Modelo: ${model})`);

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
    });

    return response.text || '';
};

/**
 * Genera cuento con OpenAI
 */
const generateWithOpenAI = async (
    apiKey: string,
    prompt: string,
    model: string = 'gpt-4o-mini'
): Promise<string> => {
    console.log('🟢 Usando OpenAI para generación, modelo:', model);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model,
            messages: [
                {
                    role: 'system',
                    content: 'Eres un autor experto de cuentos infantiles. Siempre escribes historias largas, detalladas y apropiadas para niños.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 4096,
            temperature: 0.8,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('❌ Error OpenAI:', error);
        throw new Error(error.error?.message || 'Error en OpenAI API');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
};

/**
 * Genera cuento con Claude
 */
const generateWithClaude = async (
    apiKey: string,
    prompt: string,
    model: string = 'claude-3-5-sonnet-20241022'
): Promise<string> => {
    console.log('🟣 Usando Claude para generación, modelo:', model);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
            model: model,
            max_tokens: 4096,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('❌ Error Claude:', error);
        throw new Error(error.error?.message || 'Error en Claude API');
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
};

/**
 * Genera cuento con Groq
 */
const generateWithGroq = async (
    apiKey: string,
    prompt: string,
    model: string = 'llama-3.1-70b-versatile'
): Promise<string> => {
    console.log('🟡 Usando Groq para generación, modelo:', model);

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model,
            messages: [
                {
                    role: 'system',
                    content: 'Eres un autor experto de cuentos infantiles. Siempre escribes historias largas, detalladas y apropiadas para niños.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 4096,
            temperature: 0.8,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('❌ Error Groq:', error);
        throw new Error(error.error?.message || 'Error en Groq API');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
};

/**
 * Genera cuento con Together AI
 */
const generateWithTogether = async (
    apiKey: string,
    prompt: string,
    model: string = 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo'
): Promise<string> => {
    console.log('🔴 Usando Together AI para generación, modelo:', model);

    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: model,
            messages: [
                {
                    role: 'system',
                    content: 'Eres un autor experto de cuentos infantiles. Siempre escribes historias largas, detalladas y apropiadas para niños.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            max_tokens: 4096,
            temperature: 0.8,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error('❌ Error Together:', error);
        throw new Error(error.error?.message || 'Error en Together API');
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
};

/**
 * Limpia markdown de la respuesta
 */
const stripMarkdown = (text: string): string => {
    return text
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        .replace(/#{1,6}\s?/g, '')
        .replace(/\[(.*?)\]\(.*?\)/g, '$1')
        .replace(/[`]{1,3}(.*?)[`]{1,3}/g, '$1')
        .trim();
};

/**
 * Genera contenido de cuento - Función principal
 */
export const generateStoryContent = async (
    protagonist: string,
    scenery: string,
    mission: string,
    style: string,
    storyLength: 'short' | 'medium' | 'long' = 'medium',
    targetAudience: 'child' | 'adolescent' | 'adult' | 'all' = 'child',
    customConfigStructure?: string
): Promise<string> => {
    const config = getStoredAIConfig();
    const provider = config?.activeProvider || 'gemini';

    // Normalize keys if needed
    let effectiveSize = storyLength;
    if (effectiveSize === 'small' as any) effectiveSize = 'short';
    if (effectiveSize === 'large' as any) effectiveSize = 'long';

    const customStructure = customConfigStructure || '';
    const sizeConfig = STORY_SIZE_CONFIG[effectiveSize as keyof typeof STORY_SIZE_CONFIG] || STORY_SIZE_CONFIG.medium;
    const preferredModel = config?.preferredModel;
    const effectiveAudience = targetAudience || 'child';

    console.log('🚀 Iniciando generación de cuento');
    console.log('📋 Proveedor:', provider);
    console.log('📖 Tamaño:', effectiveSize, '- Capítulos:', sizeConfig.chapters);
    console.log('👥 Audiencia:', effectiveAudience);

    const apiKey = getApiKey(provider);

    if (!apiKey) {
        throw new Error(`No se encontró API Key para ${provider}. Configúrala en el Panel Docente.`);
    }

    const prompt = buildStoryPrompt(protagonist, scenery, mission, style, sizeConfig, customStructure, effectiveAudience);
    console.log('📝 Prompt generado:', prompt.length, 'caracteres');

    let content = '';

    try {
        switch (provider) {
            case 'gemini':
                content = await generateWithGemini(apiKey, prompt, preferredModel || 'gemini-2.0-flash');
                break;
            case 'openai':
                content = await generateWithOpenAI(apiKey, prompt, preferredModel || 'gpt-4o-mini');
                break;
            case 'claude':
                content = await generateWithClaude(apiKey, prompt, preferredModel || 'claude-3-5-sonnet-20241022');
                break;
            case 'groq':
                content = await generateWithGroq(apiKey, prompt, preferredModel || 'llama-3.1-70b-versatile');
                break;
            case 'together':
                content = await generateWithTogether(apiKey, prompt, preferredModel || 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo');
                break;
            default:
                // Fallback a Gemini
                const geminiKey = getApiKey('gemini');
                if (geminiKey) {
                    content = await generateWithGemini(geminiKey, prompt, preferredModel || 'gemini-2.0-flash');
                } else {
                    throw new Error(`Proveedor "${provider}" no soportado y no hay fallback disponible`);
                }
        }

        console.log('✅ Contenido generado:', content.length, 'caracteres');

        if (content.length < 200) {
            console.warn('⚠️ Contenido muy corto, puede haber un problema');
        }

        // Limpiar markdown residual
        return stripMarkdown(content);

    } catch (error: any) {
        console.error('❌ Error en generación:', error.message);
        throw error;
    }
};

/**
 * Genera un cuento estructurado con páginas
 */
export const generateStory = async (
    protagonist: string,
    scenery: string,
    mission: string,
    style: string
): Promise<StoryResult> => {
    const content = await generateStoryContent(protagonist, scenery, mission, style);

    const title = `Las Aventuras de ${protagonist}`;

    // Dividir en capítulos
    const chapterSections = content.split(/CAPÍTULO \d+[:]?\s?/i).filter(s => s.trim().length > 20);

    const pages: StoryPage[] = chapterSections.map((section, idx) => ({
        pageNumber: idx + 1,
        content: section.trim(),
        imagePrompt: `${protagonist} en ${scenery}, escena del capítulo ${idx + 1}`,
    }));

    // Si no hay capítulos, dividir por párrafos
    if (pages.length === 0) {
        const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
        paragraphs.forEach((paragraph, index) => {
            pages.push({
                pageNumber: index + 1,
                content: paragraph.trim(),
            });
        });
    }

    return {
        title,
        pages,
        totalPages: pages.length,
    };
};

/**
 * Genera una imagen para el cuento
 */
export const generateStoryImage = async (
    prompt: string,
    style: string
): Promise<string> => {
    const config = getStoredAIConfig();
    const provider = config?.activeProvider || 'openai';

    // Default image provider logic:
    // 1. Explicitly selected image provider
    // 2. If 'freepik' key exists -> default to freepik (legacy behavior)
    // 3. Fallback to active text provider
    const imageProviderPreference = config?.activeImageProvider || (config?.apiKeys?.freepik ? 'freepik' : provider);

    const preferredModel = config?.preferredModel;

    // const apiKey = getApiKey(provider); // Text provider key - not directly used for image generation key
    // const freepikKey = getApiKey('freepik'); // Not directly used, checked via config?.apiKeys?.freepik
    // const openaiKey = getApiKey('openai'); // Not directly used, getApiKey(imageProvider) handles it

    let imageProvider = imageProviderPreference;
    let imageApiKey = getApiKey(imageProvider);
    let imageModel = preferredModel;

    // Special case: If provider is freepik, ensure model is correct
    if (imageProvider === 'freepik') {
        console.log('🎨 Usando Freepik para generar imagen');
        if (!imageModel || (!imageModel.includes('flux') && !imageModel.includes('mystic'))) {
            imageModel = 'flux-realism';
        }
    } else if (imageProvider === 'openai') {
        console.log('🎨 Usando OpenAI para generar imagen');
        imageModel = 'dall-e-3';
    } else {
        // Fallback or other providers
    }

    if (!imageApiKey) {
        console.warn('No API key for image generation, using scenery fallback');
        return getRandomImage(prompt);
    }

    try {
        console.log(`🎨 Generando imagen con ${imageProvider}...`);
        const response = await fetch('/api/ai/image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                provider: imageProvider,
                apiKey: imageApiKey,
                prompt,
                style,
                model: imageModel
            }),
        });

        if (!response.ok) {
            throw new Error(`Error generating image: ${response.statusText}`);
        }

        const data = await response.json();
        return data.data; // Base64 or URL
    } catch (error) {
        console.error("Error generando imagen AI:", error);
        // Fallback to scenery-matched Unsplash image
        return getRandomImage(prompt);
    }
};

export default {
    generateStory,
    generateStoryContent,
    generateStoryImage,
    getStoredAIConfig,
};
