export const COMMUNICATION_RESPONSE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 80 },
    cells: {
      type: 'array',
      minItems: 4,
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          label: { type: 'string', maxLength: 40 },
          imagePrompt: { type: 'string', maxLength: 300 },
        },
        required: ['label', 'imagePrompt'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'cells'],
  additionalProperties: false,
};
