import { describe, expect, it } from 'vitest';
import { pickSpanishVoice, type VoiceLike } from './speech';

const VOICES: VoiceLike[] = [
  { name: 'English (US)', lang: 'en-US' },
  { name: 'Monica', lang: 'es-ES' },
  { name: 'Jorge', lang: 'es-US' },
  { name: 'Paulina', lang: 'es-MX' },
  { name: 'Google español', lang: 'es-AR' },
];

describe('pickSpanishVoice (SPEC-015)', () => {
  it('prefers es-AR and then the regional order', () => {
    expect(pickSpanishVoice(VOICES)?.lang).toBe('es-AR');

    const withoutAr = VOICES.filter((voice) => voice.lang !== 'es-AR');
    expect(pickSpanishVoice(withoutAr)?.lang).toBe('es-US');
  });

  it('honors gender hints when a matching name exists', () => {
    const voices: VoiceLike[] = [
      { name: 'Jorge', lang: 'es-US' },
      { name: 'Monica', lang: 'es-US' },
    ];

    expect(pickSpanishVoice(voices, 'male')?.name).toBe('Jorge');
    expect(pickSpanishVoice(voices, 'female')?.name).toBe('Monica');
  });

  it('falls back to the best regional voice without a gender match', () => {
    const voices: VoiceLike[] = [
      { name: 'Voz Uno', lang: 'es-US' },
      { name: 'Voz Dos', lang: 'es-ES' },
    ];

    expect(pickSpanishVoice(voices, 'female')?.name).toBe('Voz Uno');
  });

  it('returns undefined when there are no Spanish voices', () => {
    expect(
      pickSpanishVoice([{ name: 'English', lang: 'en-US' }]),
    ).toBeUndefined();
  });

  it('prefers es-419 over es-US when available', () => {
    const voices: VoiceLike[] = [
      { name: 'Latina', lang: 'es-419' },
      { name: 'Jorge', lang: 'es-US' },
    ];

    expect(pickSpanishVoice(voices)?.lang).toBe('es-419');
  });
});
