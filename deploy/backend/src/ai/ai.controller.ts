import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AIService } from './ai.service';
import { GenerateStoryDto, ValidateApiKeyDto } from './dto/generate-story.dto';
import { GenerateImageDto } from './dto/generate-image.dto';

@Controller('ai')
export class AIController {
    constructor(private readonly aiService: AIService) { }

    /**
     * Genera un cuento usando el proveedor de IA especificado
     */
    @Post('story')
    @HttpCode(HttpStatus.OK)
    async generateStory(@Body() dto: GenerateStoryDto) {
        const providerConfig = {
            provider: dto.provider,
            apiKey: dto.apiKey,
            accountId: dto.accountId,
            model: dto.model,
        };

        const storyConfig = {
            protagonist: dto.protagonist,
            scenery: dto.scenery,
            mission: dto.mission,
            style: dto.style,
            storySize: dto.storySize,
            customStructure: dto.customStructure,
        };

        const result = await this.aiService.generateStory(providerConfig, storyConfig);

        return {
            success: true,
            data: result,
        };
    }

    /**
     * Genera una imagen usando el proveedor especificado
     */
    @Post('image')
    @HttpCode(HttpStatus.OK)
    async generateImage(@Body() dto: GenerateImageDto) {
        const providerConfig = {
            provider: dto.provider,
            apiKey: dto.apiKey,
            accountId: dto.accountId,
            model: dto.model,
        };

        const result = await this.aiService.generateImage(providerConfig, dto.prompt, dto.style);

        return {
            success: true,
            data: result,
        };
    }

    /**
     * Valida una API key para un proveedor específico
     */
    @Post('validate-key')
    @HttpCode(HttpStatus.OK)
    async validateApiKey(@Body() dto: ValidateApiKeyDto) {
        const isValid = await this.aiService.validateApiKey({
            provider: dto.provider,
            apiKey: dto.apiKey,
            accountId: dto.accountId,
        });

        return {
            success: true,
            isValid,
        };
    }

    /**
     * Obtiene la lista de proveedores de IA disponibles
     */
    @Get('providers')
    getProviders() {
        return {
            success: true,
            data: this.aiService.getAvailableProviders(),
        };
    }

    /**
     * Obtiene información sobre los tamaños de cuento disponibles
     */
    @Get('story-sizes')
    getStorySizes() {
        return {
            success: true,
            data: [
                {
                    id: 'small',
                    name: 'Pequeño',
                    pages: 5,
                    description: 'Cuento corto ideal para niños pequeños o lecturas rápidas',
                    estimatedTime: '3-5 minutos',
                },
                {
                    id: 'medium',
                    name: 'Mediano',
                    pages: 10,
                    description: 'Cuento de longitud estándar con desarrollo completo',
                    estimatedTime: '8-12 minutos',
                },
                {
                    id: 'large',
                    name: 'Grande',
                    pages: 15,
                    description: 'Cuento extenso con muchos detalles y aventuras',
                    estimatedTime: '15-20 minutos',
                },
            ],
        };
    }
}
