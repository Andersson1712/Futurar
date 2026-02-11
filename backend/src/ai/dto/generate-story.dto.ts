import { IsString, IsOptional, IsIn } from 'class-validator';

export class GenerateStoryDto {
    @IsString()
    protagonist: string;

    @IsString()
    scenery: string;

    @IsString()
    mission: string;

    @IsString()
    style: string;

    @IsIn(['small', 'medium', 'large'])
    storySize: 'small' | 'medium' | 'large';

    @IsOptional()
    @IsString()
    customStructure?: string;

    // Configuración del proveedor
    @IsIn(['gemini', 'openai', 'claude', 'groq', 'cloudflare', 'together'])
    provider: 'gemini' | 'openai' | 'claude' | 'groq' | 'cloudflare' | 'together';

    @IsOptional()
    @IsString()
    apiKey?: string;

    @IsOptional()
    @IsString()
    accountId?: string; // Para Cloudflare

    @IsOptional()
    @IsString()
    model?: string;
}

export class ValidateApiKeyDto {
    @IsIn(['gemini', 'openai', 'claude', 'groq', 'cloudflare', 'together'])
    provider: 'gemini' | 'openai' | 'claude' | 'groq' | 'cloudflare' | 'together';

    @IsOptional()
    @IsString()
    apiKey?: string;

    @IsOptional()
    @IsString()
    accountId?: string;
}
