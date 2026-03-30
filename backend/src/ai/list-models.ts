import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

async function main() {
    const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });
    try {
        console.log('Listando modelos disponibles...');
        const models = await ai.models.list();
        for await (const targetModel of models) {
            const name = targetModel.name || '';
            // if (name.includes('ima') || name.includes('flash')) {
                console.log(`- ${name} (generateContent: ${targetModel.supportedActions?.includes('generateContent')})`);
            // }
        }
    } catch (e) {
        console.error('Error:', e);
    }
}
main();
