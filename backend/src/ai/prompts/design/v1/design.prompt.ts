import type {
  DesignAudience,
  DesignOccasion,
} from '../../../domain/design-generation.types';

export interface DesignPromptParams {
  occasion: DesignOccasion;
  message: string;
  style: string;
  audience: DesignAudience;
  language: string;
}

const AUDIENCE_GUIDANCE: Record<DesignAudience, string> = {
  child:
    'Audiencia: niñas y niños de 5 a 8 años. Vocabulario simple, frases cortas, tono cálido y luminoso; sin violencia, miedo intenso ni temas adultos.',
  teen: 'Audiencia: adolescentes de 9 a 14 años. Vocabulario más rico, anuncio claro y directo; sin contenido sexual explícito ni violencia gráfica.',
  adult:
    'Audiencia: personas adultas. Tono claro y formal para anuncios; sin contenido sexual explícito ni violencia gráfica innecesaria.',
};

export function buildDesignSystemInstruction(
  params: DesignPromptParams,
): string {
  return [
    'Sos un diseñador gráfico experto en volantes accesibles.',
    `Escribís en ${params.language}, en texto plano (sin markdown).`,
    'Nunca incluyas contenido sexual, violento o discriminatorio.',
    AUDIENCE_GUIDANCE[params.audience],
    'Respondés únicamente con JSON válido que cumpla el formato solicitado.',
  ].join(' ');
}

export function buildDesignPrompt(params: DesignPromptParams): string {
  return [
    'Diseñá un volante (flyer) de una sola imagen con este encargo:',
    `- Ocasión: ${params.occasion}`,
    `- Mensaje: ${params.message}`,
    `- Estilo visual: ${params.style}`,
    '',
    'Requisitos obligatorios:',
    '1. El volante lleva un título breve (máximo 80 caracteres).',
    '2. El mensaje del volante es exactamente el mensaje del encargo, sin reescribirlo ni truncarlo (máximo 140 caracteres).',
    '3. La imagen es obligatoria: un "imagePrompt" breve en inglés que describa el visual del volante.',
    '4. Sin markdown ni etiquetas: solo texto plano dentro de cada campo.',
    '',
    'Formato de respuesta (JSON, sin texto adicional):',
    '{"title": "...", "message": "...", "imagePrompt": "..."}',
  ].join('\n');
}
