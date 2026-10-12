/**
 * SPEC-033B — the vertical a generation request belongs to.
 *
 * The ports gained this explicit `vertical` so the OpenRouter adapters stop
 * hardcoding `.book`; a missing value defaults to `'book'` (other verticals
 * keep their prior behavior). Per-vertical teacher pairs are a follow-up.
 */
export type GenerationVertical = 'book' | 'design';
