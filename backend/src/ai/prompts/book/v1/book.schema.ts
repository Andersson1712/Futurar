export const BOOK_RESPONSE_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    title: { type: 'string', maxLength: 120 },
    dedication: { type: 'string', maxLength: 200 },
    pages: {
      type: 'array',
      minItems: 1,
      maxItems: 15,
      items: {
        type: 'object',
        properties: {
          pageNumber: { type: 'integer', minimum: 1 },
          content: { type: 'string', maxLength: 2000 },
          imagePrompt: { type: 'string', maxLength: 300 },
        },
        required: ['pageNumber', 'content'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'pages'],
  additionalProperties: false,
};
