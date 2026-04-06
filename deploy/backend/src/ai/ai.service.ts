import { Injectable, BadRequestException } from '@nestjs/common';
import { AIProvider, AIProviderConfig, StoryGenerationConfig, StoryResult } from './providers/ai-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { GroqProvider } from './providers/groq.provider';
import { CloudflareProvider } from './providers/cloudflare.provider';
import { TogetherProvider } from './providers/together.provider';
import { FreepikProvider } from './providers/freepik.provider';

@Injectable()
export class AIService {
    /**
     * Obtiene una instancia del proveedor de IA según la configuración
     */
    getProvider(config: AIProviderConfig): AIProvider {
        switch (config.provider) {
            case 'gemini':
                if (!config.apiKey) throw new BadRequestException('Gemini API Key requerida');
                return new GeminiProvider(config.apiKey, config.model);

            case 'openai':
                if (!config.apiKey) throw new BadRequestException('OpenAI API Key requerida');
                return new OpenAIProvider(config.apiKey, config.model);

            case 'claude':
                if (!config.apiKey) throw new BadRequestException('Claude API Key requerida');
                return new ClaudeProvider(config.apiKey, config.model);

            case 'groq':
                if (!config.apiKey) throw new BadRequestException('Groq API Key requerida');
                return new GroqProvider(config.apiKey, config.model);

            case 'cloudflare':
                if (!config.accountId || !config.apiKey) {
                    throw new BadRequestException('Cloudflare Account ID y API Token requeridos');
                }
                return new CloudflareProvider(config.accountId, config.apiKey, config.model);

            case 'together':
                if (!config.apiKey) throw new BadRequestException('Together AI API Key requerida');
                return new TogetherProvider(config.apiKey, config.model);

            case 'freepik':
                if (!config.apiKey) throw new BadRequestException('Freepik API Key requerida');
                return new FreepikProvider(config.apiKey, config.model);

            default:
                throw new BadRequestException(`Proveedor "${config.provider}" no soportado`);
        }
    }

    /**
     * Genera un cuento usando el proveedor especificado
     */
    async generateStory(
        providerConfig: AIProviderConfig,
        storyConfig: StoryGenerationConfig
    ): Promise<StoryResult> {
        const provider = this.getProvider(providerConfig);
        return provider.generateStory(storyConfig);
    }

    async generateImage(
        providerConfig: AIProviderConfig,
        prompt: string,
        style: string = 'vivid'
    ): Promise<string> {
        const provider = this.getProvider(providerConfig);
        if (!provider.generateImage) {
            // No throw error, just return fallback
            console.warn(`El proveedor ${provider.name} no soporta generación de imágenes`);
            return this.getFallbackImage(style);
        }

        try {
            return await provider.generateImage(prompt, style);
        } catch (error) {
            console.error(`Error generating image with ${providerConfig.provider}:`, error);
            return this.getFallbackImage(style);
        }
    }

    private getFallbackImage(style: string): string {
        // picsum.photos is CORS-friendly and reliable (source.unsplash.com was deprecated)
        const seed = encodeURIComponent(style.split(' ')[0] || 'story');
        return `https://picsum.photos/seed/${seed}/800/800`;
    }

    /**
     * Valida la API key del proveedor
     */
    async validateApiKey(config: AIProviderConfig): Promise<boolean> {
        try {
            const provider = this.getProvider(config);
            if (provider.validateApiKey) {
                return await provider.validateApiKey();
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Retorna la lista de proveedores disponibles con su información
     */
    getAvailableProviders() {
        return [
            {
                id: 'gemini',
                name: 'Google Gemini',
                description: 'IA de Google, gratis con límites generosos',
                isFree: true,
                requiredFields: ['apiKey'],
                models: [
                    'gemini-2.0-flash',
                    'gemini-2.0-flash-lite-preview-02-05',
                    'gemini-2.0-pro-exp-02-05',
                    'gemini-2.0-flash-thinking-exp-01-21',
                    'gemini-1.5-pro',
                    'gemini-1.5-flash',
                    // Modelos solicitados (beta/futuros)
                    'gemini-2.5-flash',
                    'gemini-2.5-pro',
                    'gemini-3.0-flash',
                    'gemini-3.0-pro',
                ],
                getKeyUrl: 'https://aistudio.google.com/app/apikey',
            },
            {
                id: 'groq',
                name: 'Groq (Llama 3.1)',
                description: 'Ultra rápido, gratuito, usa Llama 3.1',
                isFree: true,
                requiredFields: ['apiKey'],
                models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
                getKeyUrl: 'https://console.groq.com/keys',
            },
            {
                id: 'cloudflare',
                name: 'Cloudflare AI',
                description: 'Gratis, 10,000 tokens/día, Llama y Mistral',
                isFree: true,
                requiredFields: ['accountId', 'apiKey'],
                models: ['@cf/meta/llama-3.1-8b-instruct', '@cf/mistral/mistral-7b-instruct-v0.1'],
                getKeyUrl: 'https://dash.cloudflare.com/profile/api-tokens',
            },
            {
                id: 'together',
                name: 'Together AI',
                description: 'Tier gratuito disponible, múltiples modelos open source',
                isFree: true,
                requiredFields: ['apiKey'],
                models: ['meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
                getKeyUrl: 'https://api.together.xyz/settings/api-keys',
            },
            {
                id: 'openai',
                name: 'OpenAI (GPT-4)',
                description: 'Modelos GPT de OpenAI, de pago',
                isFree: false,
                requiredFields: ['apiKey'],
                models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
                getKeyUrl: 'https://platform.openai.com/api-keys',
            },
            {
                id: 'claude',
                name: 'Anthropic Claude',
                description: 'Claude 3.5, modelos de alta calidad, de pago',
                isFree: false,
                requiredFields: ['apiKey'],
                models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
                getKeyUrl: 'https://console.anthropic.com/settings/keys',
            },
        ];
    }
}
