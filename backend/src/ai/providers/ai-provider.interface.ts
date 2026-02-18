export interface AIProvider {
    name: string;
    displayName: string;
    generateStory(config: StoryGenerationConfig): Promise<StoryResult>;
    generateImage?(prompt: string, style?: string): Promise<string>; // Returns base64 or URL
    validateApiKey?(): Promise<boolean>;
}

export interface StoryGenerationConfig {
    protagonist: string;
    scenery: string;
    mission: string;
    style: string;
    storySize: 'small' | 'medium' | 'large'; // 5, 10, 15 páginas
    customStructure?: string; // Estructura personalizada del cuento
}

export interface StoryResult {
    title: string;
    pages: StoryPage[];
    totalPages: number;
}

export interface StoryPage {
    pageNumber: number;
    content: string;
    imagePrompt?: string;
}

// Mapeo de tamaño a número de páginas
export const STORY_SIZE_PAGES: Record<'small' | 'medium' | 'large', number> = {
    small: 5,
    medium: 10,
    large: 15,
};

// Proveedores disponibles
// Proveedores disponibles
export type AIProviderType = 'gemini' | 'openai' | 'claude' | 'groq' | 'cloudflare' | 'together' | 'freepik';

export interface AIProviderConfig {
    provider: AIProviderType;
    apiKey?: string;
    accountId?: string; // Para Cloudflare
    model?: string;
}
