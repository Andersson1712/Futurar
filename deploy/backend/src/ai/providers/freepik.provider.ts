import { AIProvider, StoryGenerationConfig, StoryResult } from './ai-provider.interface';

export class FreepikProvider implements AIProvider {
    name = 'Freepik';
    displayName = 'Freepik Image Generator';
    id = 'freepik';

    constructor(private apiKey: string, private model: string = 'flux-realism') { }

    async generateStory(config: StoryGenerationConfig): Promise<StoryResult> {
        throw new Error('Freepik provider only supports image generation');
    }

    private logToFile(message: string, data?: any) {
        try {
            const fs = require('fs');
            const path = require('path');
            const logPath = path.join(process.cwd(), 'freepik.log');
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] ${message} ${data ? JSON.stringify(data) : ''}\n`;
            fs.appendFileSync(logPath, logEntry);
        } catch (e) {
            console.error('Failed to write to log file', e);
        }
    }

    async generateImage(prompt: string, style: string = 'cinematic'): Promise<string> {
        this.logToFile('Starting generateImage', { prompt, style, model: this.model });
        try {
            console.log(`🎨 Generando imagen con Freepik (${this.model})... Style: ${style}`);

            let modelId = this.model;
            // Map legacy/internal 'flux-realism' to actual API 'flux-dev'
            if (modelId === 'flux-realism' || !modelId) {
                modelId = 'flux-dev';
            }

            const url = `https://api.freepik.com/v1/ai/text-to-image/${modelId}`;
            this.logToFile(`Request URL: ${url}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-freepik-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    prompt: `${style} style. ${prompt}`,
                    aspect_ratio: "square_1_1",
                    num_images: 1
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                this.logToFile('API Request Failed', { status: response.status, errorText });
                throw new Error(`Freepik API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            this.logToFile('Initial Response', data);

            // Check for direct response (synchronous)
            if (data.data) {
                if (Array.isArray(data.data) && data.data.length > 0) {
                    const img = data.data[0];
                    if (img.base64 || img.url) {
                        this.logToFile('Image received directly');
                        return img.base64 ? `data:image/png;base64,${img.base64}` : img.url;
                    }
                }
            }

            // Scenario 2: Async Generation (Flux usually returns { data: { task_id: "..." } })
            if (data.data && data.data.task_id) {
                const taskId = data.data.task_id;
                this.logToFile(`Task ID received: ${taskId}. Polling...`);
                return await this.pollForImage(taskId, modelId);
            }

            // Fallback for older/different models if they return top-level id
            if (data.id) {
                this.logToFile(`Task ID received (legacy): ${data.id}. Polling...`);
                return await this.pollForImage(data.id, modelId);
            }

            this.logToFile('Unrecognized response format', data);
            throw new Error('Unrecognized response format from Freepik (No data/ID)');

        } catch (error: any) {
            this.logToFile('Error in generateImage', { message: error.message, stack: error.stack });
            console.error('❌ Error generating image with Freepik:', error.message);
            throw error;
        }
    }

    private async pollForImage(taskId: string, modelId: string): Promise<string> {
        const MAX_RETRIES = 120; // 4 minutes approx
        const DELAY = 2000;
        let useLegacyUrl = false;

        for (let i = 0; i < MAX_RETRIES; i++) {
            await new Promise(resolve => setTimeout(resolve, DELAY));

            try {
                // Try specific model URL first, fall back to generic if 404 encountered
                let statusUrl = useLegacyUrl
                    ? `https://api.freepik.com/v1/ai/text-to-image/${taskId}`
                    : `https://api.freepik.com/v1/ai/text-to-image/${modelId}/${taskId}`;

                this.logToFile(`Polling attempt ${i + 1}/${MAX_RETRIES}`, { url: statusUrl, useLegacyUrl });

                const response = await fetch(statusUrl, {
                    headers: {
                        'x-freepik-api-key': this.apiKey,
                        'Accept': 'application/json'
                    }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    this.logToFile(`Poll failed status: ${response.status}`, { errorText });

                    if (response.status === 404) {
                        // If we haven't tried legacy yet, switch to it for next time
                        if (!useLegacyUrl) {
                            this.logToFile('404 on model URL, switching to legacy URL for next attempt');
                            useLegacyUrl = true;
                        }
                        continue;
                    }
                    throw new Error(`Polling failed with status ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                this.logToFile('Poll data received', data);

                // Handle both top-level status and nested data.status
                const status = data.status || (data.data && data.data.status);

                if (status === 'COMPLETED') {
                    // PARSE IMAGE LOGIC FIXED HERE
                    let finalUrl = null;

                    // Case 1: data.data.generated (Array of strings) - Flux Dev style
                    if (data.data && Array.isArray(data.data.generated) && data.data.generated.length > 0) {
                        finalUrl = data.data.generated[0];
                    }
                    // Case 2: data.data array of objects
                    else if (Array.isArray(data.data) && data.data.length > 0) {
                        const img = data.data[0];
                        finalUrl = img.base64 ? `data:image/png;base64,${img.base64}` : img.url;
                    }
                    // Case 3: data.data object
                    else if (data.data && (data.data.base64 || data.data.url)) {
                        finalUrl = data.data.base64 ? `data:image/png;base64,${data.data.base64}` : data.data.url;
                    }
                    // Case 4: data.result
                    else if (data.result) {
                        const img = data.result;
                        finalUrl = img.base64 ? `data:image/png;base64,${img.base64}` : img.url;
                    }

                    if (finalUrl) {
                        this.logToFile('Polling SUCCESS - Image found', { finalUrl });
                        return finalUrl;
                    }

                    this.logToFile('Completed but NO image data found', data);
                } else if (status === 'FAILED') {
                    this.logToFile('Generation FAILED', data);
                    throw new Error('Freepik generation FAILED');
                } else if (['CREATED', 'IN_PROGRESS', 'PENDING', 'QB-PROCESSED', 'QB-PROCESSING', 'R-PROCESSED', 'R-PROCESSING'].includes(status)) {
                    continue;
                } else {
                    this.logToFile('Unknown polling status', { status, data });
                }

            } catch (e) {
                this.logToFile(`Polling iteration error`, e);
                console.warn(`Polling error (attempt ${i}):`, e);
            }
        }
        this.logToFile('Polling Timeout');
        throw new Error('Timeout waiting for Freepik image generation');
    }

    async validateApiKey(): Promise<boolean> {
        return this.apiKey.length > 0;
    }
}
