import { Injectable } from '@nestjs/common';
import { AiProviderError } from '../ai.errors';

@Injectable()
export class PresentationOutputParser {
  parse(text: string): unknown {
    const json = extractPresentationJson(text);

    if (!json) {
      throw new AiProviderError(
        'INVALID_OUTPUT',
        'The provider returned no JSON content',
      );
    }

    try {
      return JSON.parse(json) as unknown;
    } catch {
      throw new AiProviderError(
        'INVALID_OUTPUT',
        'The provider returned invalid JSON',
      );
    }
  }
}

export function extractPresentationJson(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const body = (fenced?.[1] ?? trimmed).trim();

  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');

  if (start === -1 || end <= start) return undefined;

  return body.slice(start, end + 1);
}
