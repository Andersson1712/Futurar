/**
 * Shared TTS (Text-to-Speech) utilities
 * Centralizes voice synthesis functionality used across components
 */

import type { VoiceGender } from './accessibility';

export interface SpeakOptions {
    rate?: number;
    volume?: number;
    pitch?: number;
    lang?: string;
    onStart?: () => void;
    onEnd?: () => void;
}

export interface VoiceLike {
    name: string;
    lang: string;
}

const defaultOptions: SpeakOptions = {
    rate: 0.9,
    volume: 1.0,
    pitch: 1.0,
    lang: 'es-AR',
};

// Spanish fallback order: es-AR is not always available on devices (MEMORY).
const LANG_PRIORITY = ['es-AR', 'es-419', 'es-US', 'es-MX', 'es-ES'];

const FEMALE_HINTS = [
    'female', 'mujer', 'monica', 'mónica', 'paulina', 'helena', 'laura',
    'sabina', 'elvira', 'sofia', 'sofía', 'karen', 'zira', 'carmela',
];

const MALE_HINTS = [
    'male', 'hombre', 'jorge', 'juan', 'diego', 'carlos', 'enrique',
    'pablo', 'raul', 'raúl', 'ricardo', 'alonso',
];

let voicePreference: { gender: VoiceGender; lang: string } = {
    gender: 'auto',
    lang: defaultOptions.lang!,
};

/**
 * Picks the best Spanish voice for the requested gender (SPEC-015).
 * Preference: es-AR → es-419 → es-US → es-MX → es-ES → any `es`.
 */
export const pickSpanishVoice = (
    voices: VoiceLike[],
    gender: VoiceGender = 'auto',
): VoiceLike | undefined => {
    const spanish = voices.filter((voice) =>
        voice.lang?.toLowerCase().startsWith('es')
    );

    if (spanish.length === 0) return undefined;

    const rank = (lang: string): number => {
        const position = LANG_PRIORITY.findIndex(
            (candidate) => candidate.toLowerCase() === lang.toLowerCase()
        );

        return position === -1 ? LANG_PRIORITY.length : position;
    };

    const ordered = [...spanish].sort((a, b) => rank(a.lang) - rank(b.lang));

    if (gender !== 'auto') {
        const hints = gender === 'female' ? FEMALE_HINTS : MALE_HINTS;
        const match = ordered.find((voice) =>
            hints.some((hint) => voice.name.toLowerCase().includes(hint))
        );

        if (match) return match;
    }

    return ordered[0];
};

/**
 * Stores the profile voice preference used by `speak`.
 */
export const configureSpeechVoice = (preference: {
    gender?: VoiceGender;
    lang?: string;
}): void => {
    voicePreference = { ...voicePreference, ...preference };
};

const resolveVoice = (): SpeechSynthesisVoice | undefined => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
        return undefined;
    }

    const voices = window.speechSynthesis.getVoices();
    const picked = pickSpanishVoice(
        voices.map((voice) => ({ name: voice.name, lang: voice.lang })),
        voicePreference.gender
    );

    if (!picked) return undefined;

    return voices.find(
        (voice) => voice.name === picked.name && voice.lang === picked.lang
    );
};

/**
 * Speaks text using Web Speech API
 * @param text Text to speak
 * @param options Speech options (rate, volume, pitch, lang, callbacks)
 * @returns The SpeechSynthesisUtterance instance
 */
export const speak = (text: string, options: SpeakOptions = {}): SpeechSynthesisUtterance | null => {
    if (!text || typeof window === 'undefined') return null;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const opts = { ...defaultOptions, ...options };
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = resolveVoice();

    if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
    } else {
        utterance.lang = voicePreference.lang || opts.lang!;
    }

    utterance.rate = opts.rate!;
    utterance.volume = opts.volume!;
    utterance.pitch = opts.pitch!;

    if (opts.onStart) {
        utterance.onstart = opts.onStart;
    }
    if (opts.onEnd) {
        utterance.onend = opts.onEnd;
    }

    window.speechSynthesis.speak(utterance);
    return utterance;
};

/**
 * Stops any ongoing speech synthesis
 */
export const stopSpeaking = (): void => {
    if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
    }
};

/**
 * Speaks an option label during scanning (faster rate)
 * @param label Option label to speak
 */
export const speakOption = (label: string): void => {
    speak(label, { rate: 1.1, volume: 0.8 });
};

/**
 * Announces break mode with a friendly message
 * @param onEnd Callback when announcement finishes
 */
export const announceBreak = (onEnd?: () => void): void => {
    speak(
        'Tomando un descanso. Estaré aquí cuando regreses.',
        { rate: 0.9, volume: 1.0, onEnd }
    );
};

/**
 * Announces return from break
 */
export const announceResume = (): void => {
    speak('¡Bienvenido de vuelta! Continuemos.', { rate: 0.9, volume: 1.0 });
};

/**
 * Check if speech synthesis is currently speaking
 */
export const isSpeaking = (): boolean => {
    return typeof window !== 'undefined' && window.speechSynthesis.speaking;
};

export default {
    speak,
    stopSpeaking,
    speakOption,
    announceBreak,
    announceResume,
    isSpeaking,
    pickSpanishVoice,
    configureSpeechVoice,
};
