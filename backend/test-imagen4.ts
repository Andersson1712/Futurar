import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import path from 'node:path';

// Leer el .env de forma segura
const envPath = path.resolve('../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

let apiKey = '';
for (const line of envContent.split('\n')) {
    if (line.trim().startsWith('VITE_GEMINI_API_KEY=')) {
        apiKey = line.split('=')[1].trim();
        break;
    }
}

if (!apiKey) {
    console.error('No se encontró VITE_GEMINI_API_KEY en el root .env');
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

async function testImagen4() {
    console.log('🤖 Probando generación con imagen-4.0-fast-generate-001 (Usando tu API Key: ' + apiKey.substring(0, 8) + '...)');
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-fast-generate-001',
            prompt: 'An astronaut riding a futuristic horse in Mars',
            config: {
                numberOfImages: 1,
                aspectRatio: '1:1',
                personGeneration: 'ALLOW_ADULT' as any
            }
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
            console.log('✅ ¡ÉXITO! Imagen generada correctamente.');
            console.log(`✅ Tamaño del buffer de imagen en base64: ${response.generatedImages[0].image?.imageBytes?.length} caracteres.`);
        } else {
            console.log('❌ Falló: No se devolvieron imágenes.');
        }

    } catch (e: any) {
        console.error('❌ ERROR generando la imagen:', e.message);
    }
}

testImagen4();
