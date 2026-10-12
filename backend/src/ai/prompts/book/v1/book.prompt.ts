import type {
  Audience,
  StorySize,
} from '../../../domain/book-generation.types';

export interface BookDedicationParams {
  to: string;
  reason: string;
  position: 'start' | 'end';
}

export interface BookPromptParams {
  protagonist: string;
  scenery: string;
  mission: string;
  style: string;
  storySize: StorySize;
  customStructure?: string;
  dedication?: BookDedicationParams;
  audience: Audience;
  language: string;
}

export interface BookPageSpec {
  pages: number;
  minWords: number;
  maxWords: number;
}

export const BOOK_PAGE_SPECS: Record<StorySize, BookPageSpec> = {
  small: { pages: 5, minWords: 80, maxWords: 120 },
  medium: { pages: 10, minWords: 100, maxWords: 150 },
  large: { pages: 15, minWords: 120, maxWords: 180 },
};

const AUDIENCE_GUIDANCE: Record<Audience, string> = {
  child:
    'Audiencia: niñas y niños de 5 a 8 años. Vocabulario simple, frases cortas, tono cálido y luminoso; sin violencia, miedo intenso ni temas adultos.',
  teen: 'Audiencia: adolescentes de 9 a 14 años. Vocabulario más rico, aventura y emociones con matices; sin contenido sexual explícito ni violencia gráfica.',
  adult:
    'Audiencia: personas adultas. Tono literario y reflexivo; sin contenido sexual explícito ni violencia gráfica innecesaria.',
};

export function buildBookSystemInstruction(params: BookPromptParams): string {
  return [
    'Sos un autor galardonado de cuentos infantiles y juveniles.',
    `Escribís en ${params.language}, en texto plano (sin markdown).`,
    'Nunca incluyas contenido sexual, violento o discriminatorio.',
    AUDIENCE_GUIDANCE[params.audience],
    'Respondés únicamente con JSON válido que cumpla el formato solicitado.',
  ].join(' ');
}

export function buildBookPrompt(params: BookPromptParams): string {
  const spec = BOOK_PAGE_SPECS[params.storySize];
  const lines: string[] = [
    'Escribí un cuento completo con esta sinopsis:',
    `- Protagonista: ${params.protagonist}`,
    `- Escenario: ${params.scenery}`,
    `- Misión u objetivo: ${params.mission}`,
    `- Estilo visual: ${params.style}`,
    '',
    'Requisitos obligatorios:',
    `1. Exactamente ${spec.pages} páginas.`,
    `2. Cada página debe tener entre ${spec.minWords} y ${spec.maxWords} palabras, en 2 o 3 párrafos.`,
    '3. La misión debe completarse con éxito y el final debe dejar una moraleja positiva.',
    '4. Incluí diálogos y descripciones sensoriales (colores, sonidos, olores, texturas).',
    '5. Sin markdown ni etiquetas: solo texto plano dentro de cada campo.',
    '6. Para cada página, un "imagePrompt" breve en inglés que describa la escena visual.',
  ];

  if (params.customStructure?.trim()) {
    lines.push(
      '',
      'Estructura adicional solicitada:',
      params.customStructure.trim(),
    );
  }

  if (params.dedication) {
    const when =
      params.dedication.position === 'start' ? 'al comienzo' : 'al final';

    lines.push(
      '',
      `Incluí una dedicatoria breve (máximo 200 caracteres) que se ubicará ${when} del libro, dedicada a "${params.dedication.to}" porque "${params.dedication.reason}". Devolvela en el campo "dedication".`,
    );
  }

  lines.push(
    '',
    'Formato de respuesta (JSON, sin texto adicional):',
    '{"title": "...", "dedication": "...", "pages": [{"pageNumber": 1, "content": "...", "imagePrompt": "..."}]}',
  );

  return lines.join('\n');
}
