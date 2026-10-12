import type {
  PresentationAudience,
  PresentationSlideCount,
} from '../../../domain/presentation-generation.types';

export interface PresentationPromptParams {
  topic: string;
  style: string;
  audience: PresentationAudience;
  slideCount: PresentationSlideCount;
  language: string;
}

const AUDIENCE_GUIDANCE: Record<PresentationAudience, string> = {
  child:
    'Audiencia: niñas y niños de 5 a 8 años. Vocabulario simple, frases cortas, tono cálido y luminoso; sin violencia, miedo intenso ni temas adultos.',
  teen: 'Audiencia: adolescentes de 9 a 14 años. Vocabulario más rico, mensaje claro y directo; sin contenido sexual explícito ni violencia gráfica.',
  adult:
    'Audiencia: personas adultas. Tono claro y formal para exposiciones; sin contenido sexual explícito ni violencia gráfica innecesaria.',
};

export function buildPresentationSystemInstruction(
  params: PresentationPromptParams,
): string {
  return [
    'Sos un experto en presentaciones accesibles.',
    `Escribís en ${params.language}, en texto plano (sin markdown).`,
    'Nunca incluyas contenido sexual, violento o discriminatorio.',
    AUDIENCE_GUIDANCE[params.audience],
    'Respondés únicamente con JSON válido que cumpla el formato solicitado.',
  ].join(' ');
}

export function buildPresentationPrompt(
  params: PresentationPromptParams,
): string {
  return [
    'Diseñá una presentación accesible con este encargo:',
    `- Tema: ${params.topic}`,
    `- Estilo visual: ${params.style}`,
    `- Cantidad de diapositivas: ${params.slideCount}`,
    '',
    'Requisitos obligatorios:',
    '1. La presentación lleva un título breve (máximo 80 caracteres).',
    `2. Exactamente ${params.slideCount} diapositivas, ni más ni menos.`,
    '3. Cada diapositiva lleva un título breve (máximo 80 caracteres).',
    '4. Cada diapositiva lleva de 2 a 5 viñetas cortas (máximo 140 caracteres cada una), en texto plano.',
    '5. Cada diapositiva lleva un "imagePrompt" breve en inglés que describa su visual.',
    '6. Sin markdown ni etiquetas: solo texto plano dentro de cada campo.',
    '',
    'Formato de respuesta (JSON, sin texto adicional):',
    '{"title": "...", "slides": [{"title": "...", "bullets": ["...", "..."], "imagePrompt": "..."}]}',
  ].join('\n');
}
