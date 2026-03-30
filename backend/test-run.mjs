import fs from 'fs';
import { GoogleGenAI } from '@google/genai';

const env = fs.readFileSync('../.env', 'utf8');
const keyLine = env.split('\n').find(l => l.trim().startsWith('VITE_GEMINI_API_KEY='));
const key = keyLine ? keyLine.split('=')[1].trim() : '';

if (!key) {
    console.error("No VITE_GEMINI_API_KEY found.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: key });

async function run() {
  console.log("Prompt: 'A cute magic fox'");
  console.log("Model: imagen-4.0-fast-generate-001");
  try {
    const res = await ai.models.generateImages({
      model: 'imagen-4.0-fast-generate-001',
      prompt: 'A cute magic fox',
      config: { numberOfImages: 1, aspectRatio: '1:1', personGeneration: 'ALLOW_ADULT' }
    });
    console.log("✅ ÉXITO. Imágenes recibidas:", res.generatedImages && res.generatedImages.length);
  } catch (e) {
    console.error("❌ ERROR:", e.message);
  }
}
run();
