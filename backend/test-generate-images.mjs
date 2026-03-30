import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';

const env = fs.readFileSync('../.env', 'utf8');
const lines = env.split('\n');
let key = '';
for (const line of lines) {
  if (line.includes('VITE_GEMINI_API_KEY=')) {
    key = line.split('VITE_GEMINI_API_KEY=')[1].trim();
  }
}

async function main() {
    console.log('API Key leída:', key.substring(0, 5) + '...');
    const ai = new GoogleGenAI({ apiKey: key });
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
        console.error('Error:', e.message);
    }
}
main();
