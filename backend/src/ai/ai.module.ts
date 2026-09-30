import { Module } from '@nestjs/common';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';
import { AiEndpointsEnabledGuard } from './guards/ai-endpoints-enabled.guard';

@Module({
    controllers: [AIController],
    providers: [AIService, AiEndpointsEnabledGuard],
    exports: [AIService],
})
export class AIModule { }
