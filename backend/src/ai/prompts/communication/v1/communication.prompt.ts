import type {
  CommunicationAudience,
  CommunicationCellCount,
  CommunicationKind,
} from '../../../domain/communication-generation.types';

export interface CommunicationPromptParams {
  kind: CommunicationKind;
  topic: string;
  style: string;
  audience: CommunicationAudience;
  cellCount: CommunicationCellCount;
  language: string;
}

const KIND_GUIDANCE: Record<CommunicationKind, string> = {
  feelings:
    'Tablero de sentimientos: celdas con emociones básicas que un niño puede sentir (contento, triste, cansado, enojado, con miedo, tranquilo). Etiquetas de una o dos palabras.',
  help: 'Tablero para pedir ayuda: celdas con necesidades concretas (agua, baño, ayuda, comer, descansar, mamá). Etiquetas de una o dos palabras.',
  custom:
    'Tablero personalizado: celdas con mensajes cortos sobre el tema del encargo. Etiquetas de una o dos palabras.',
};

const AUDIENCE_GUIDANCE: Record<CommunicationAudience, string> = {
  child:
    'Audiencia: niñas y niños de 5 a 8 años. Vocabulario simple, una o dos palabras por celda, tono cálido; sin violencia, miedo intenso ni temas adultos.',
  teen: 'Audiencia: adolescentes de 9 a 14 años. Etiquetas breves y claras; sin contenido sexual explícito ni violencia gráfica.',
  adult:
    'Audiencia: personas adultas. Etiquetas breves y formales; sin contenido sexual explícito ni violencia gráfica innecesaria.',
};

export function buildCommunicationSystemInstruction(
  params: CommunicationPromptParams,
): string {
  return [
    'Sos un experto en tableros de comunicación aumentativa y alternativa.',
    `Escribís en ${params.language}, en texto plano (sin markdown).`,
    'Nunca incluyas contenido sexual, violento o discriminatorio.',
    KIND_GUIDANCE[params.kind],
    AUDIENCE_GUIDANCE[params.audience],
    'Respondés únicamente con JSON válido que cumpla el formato solicitado.',
  ].join(' ');
}

export function buildCommunicationPrompt(
  params: CommunicationPromptParams,
): string {
  return [
    'Diseñá un tablero de comunicación con este encargo:',
    `- Tipo: ${params.kind}`,
    `- Tema: ${params.topic}`,
    `- Estilo visual: ${params.style}`,
    `- Cantidad de celdas: ${params.cellCount}`,
    '',
    'Requisitos obligatorios:',
    '1. El tablero lleva un título breve (máximo 80 caracteres).',
    `2. Exactamente ${params.cellCount} celdas, ni más ni menos.`,
    '3. Cada celda lleva una etiqueta brevísima (máximo 40 caracteres, idealmente una o dos palabras).',
    '4. Cada celda lleva un "imagePrompt" breve en inglés que describa un pictograma simple y claro.',
    '5. Sin markdown ni etiquetas: solo texto plano dentro de cada campo.',
    '',
    'Formato de respuesta (JSON, sin texto adicional):',
    '{"title": "...", "cells": [{"label": "...", "imagePrompt": "..."}]}',
  ].join('\n');
}
