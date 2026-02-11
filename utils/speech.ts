/**
 * Shared TTS (Text-to-Speech) utilities
 * Centralizes voice synthesis functionality used across components
 */

export interface SpeakOptions {
    rate?: number;
    volume?: number;
    pitch?: number;
    lang?: string;
    onStart?: () => void;
    onEnd?: () => void;
}

const defaultOptions: SpeakOptions = {
    rate: 0.9,
    volume: 1.0,
    pitch: 1.0,
    lang: 'es-ES',
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

    utterance.lang = opts.lang!;
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
};
