import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import type { AIProviderType } from '../providers/ai-provider.interface';

export class GenerateImageDto {
    @IsEnum(['openai', 'gemini', 'claude', 'groq', 'cloudflare', 'together', 'freepik'])
    provider: AIProviderType;

    @IsString()
    @IsNotEmpty()
    apiKey: string;

    @IsString()
    @IsOptional()
    accountId?: string;

    @IsString()
    @IsNotEmpty()
    prompt: string;

    @IsString()
    @IsOptional()
    style?: string;

    @IsString()
    @IsOptional()
    model?: string;
}
