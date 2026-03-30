import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' }); // El usuario dijo que agregó VITE_GEMINI_API_KEY a .env

async function main() {
    const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });
    try {
        console.log('Probando imagen-4.0-fast-generate-001 con generateImages...');
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-fast-generate-001',
            prompt: 'A cute cartoon robot',
            config: {
                numberOfImages: 1,
                aspectRatio: '1:1',
            }
        });
        
        console.log('ÉXITO!');
        console.log('Imágenes generadas:', response.generatedImages?.length);
    } catch (e) {
        console.error('Error:', e);
    }
}
main();
