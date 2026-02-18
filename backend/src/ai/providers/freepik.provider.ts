import { AIProvider, StoryGenerationConfig, StoryResult } from './ai-provider.interface';

export class FreepikProvider implements AIProvider {
    name = 'Freepik';
    displayName = 'Freepik Image Generator';
    id = 'freepik';

    constructor(private apiKey: string, private model: string = 'flux-realism') { }

    async generateStory(config: StoryGenerationConfig): Promise<StoryResult> {
        throw new Error('Freepik provider only supports image generation');
    }

    async generateImage(prompt: string, style: string = 'cinematic'): Promise<string> {
        try {
            console.log(`🎨 Generando imagen con Freepik (${this.model})... Style: ${style}`);

            // Endpoint for Flux Realism (or logic to select model based on this.model)
            // Defaulting to flux-realism for high quality
            const modelId = this.model || 'flux-realism';
            const url = `https://api.freepik.com/v1/ai/text-to-image/${modelId}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'x-freepik-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    prompt: `${style} style. ${prompt}`,
                    aspect_ratio: "square",
                    num_images: 1,
                    // safety_filter_level: "sensitive" // Optional, depending on API defaults
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Freepik API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            // Freepik usually returns an array of objects with 'base64' or 'url'
            // Checking response structure based on common patterns. 
            // If data is { data: [{ base64: "..." }] } or { data: [{ url: "..." }] }

            const imageObj = data.data?.[0] || data[0];

            if (!imageObj) {
                throw new Error('No image data returned from Freepik');
            }

            if (imageObj.base64) {
                return `data:image/png;base64,${imageObj.base64}`;
            } else if (imageObj.url) {
                return imageObj.url;
            } else {
                throw new Error('Unrecognized response format from Freepik');
            }

        } catch (error) {
            console.error('Error generating image with Freepik:', error);
            throw error;
        }
    }

    async validateApiKey(): Promise<boolean> {
        // Simple check implies trying a lightweight call or just checking length
        // For now, we assume true if it's not empty, as specific validation endpoint 
        // might not be documented/standard.
        return this.apiKey.length > 0;
    }
}
