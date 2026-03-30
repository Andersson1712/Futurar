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
  const modelName = 'gemini-2.5-flash-image-preview';
  console.log(`Probando modelo: ${modelName}`);

  try {
    const res = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text: "A cute magic fox in the forest" }] }],
      config: {
        responseModalities: ["IMAGE"]
      }
    });

    const parts = res.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData?.data);

    if (imagePart) {
      console.log("✅ ÉXITO. Imagen recibida en base64. Tamaño buffer:", imagePart.inlineData.data.length);
    } else {
      console.log("❌ No se encontró inlineData (imagen) en la respuesta:", JSON.stringify(parts, null, 2));
    }
  } catch (e) {
    console.error("❌ ERROR con " + modelName + " ::", e.message);
  }
}
run();
