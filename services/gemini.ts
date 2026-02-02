
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateStoryContent = async (protagonist: string, scenery: string, mission: string, style: string) => {
  const prompt = `Escribe un cuento corto de 3 a 4 oraciones para niños. 
  Protagonista: ${protagonist}. 
  Escenario: ${scenery}. 
  Misión/Objetivo: ${mission}.
  Estilo narrativo: ${style}.
  El cuento debe ser emocionante, tierno y concluir la misión con éxito.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      maxOutputTokens: 300,
      thinkingConfig: { thinkingBudget: 0 }
    },
  });

  return response.text;
};

export const generateStoryImage = async (protagonist: string, scenery: string, mission: string, style: string) => {
  const prompt = `Una ilustración de alta calidad de un ${protagonist} en un ${scenery} realizando la misión de ${mission}, estilo artístico ${style}. Colores vibrantes, amigable para niños, composición cinemática.`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: "16:9"
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  return 'https://picsum.photos/1200/800';
};
