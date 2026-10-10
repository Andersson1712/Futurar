export const PRESENTATION_RESPONSE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 80 },
    slides: {
      type: 'array',
      minItems: 5,
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: 80 },
          bullets: {
            type: 'array',
            minItems: 2,
            maxItems: 5,
            items: { type: 'string', maxLength: 140 },
          },
          imagePrompt: { type: 'string', maxLength: 300 },
        },
        required: ['title', 'bullets', 'imagePrompt'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'slides'],
  additionalProperties: false,
};
