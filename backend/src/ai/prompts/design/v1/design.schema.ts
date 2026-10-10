export const DESIGN_RESPONSE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 80 },
    message: { type: 'string', maxLength: 140 },
    imagePrompt: { type: 'string', maxLength: 300 },
  },
  required: ['title', 'message', 'imagePrompt'],
  additionalProperties: false,
};
