/**
 * Shared audio utilities
 * Centralizes sound effects used across components
 */

// Base64 encoded selection sound (short click/beep)
const SELECTION_SOUND_DATA = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleA0oXpe53aVxEhxDho+wnnh5VU59hrGmmIl0TU5yiKCpm5R4WktDSHWYpqGJdFM+KyRnl6qhfGJUOiU8b5ymk4huWEU0N16Vs5mBcGBOPTo=';

/**
 * Plays the selection sound effect
 * @param volume Volume level (0.0 to 1.0)
 */
export const playSelectionSound = (volume: number = 0.3): void => {
    try {
        const audio = new Audio(SELECTION_SOUND_DATA);
        audio.volume = volume;
        audio.play().catch(() => {
            // Silently fail - some browsers block autoplay
        });
    } catch {
        // Audio not supported
    }
};

/**
 * Plays a success sound
 */
export const playSuccessSound = (): void => {
    playSelectionSound(0.4);
};

/**
 * Plays an error sound
 */
export const playErrorSound = (): void => {
    // Could add a different sound here
    playSelectionSound(0.2);
};

export default {
    playSelectionSound,
    playSuccessSound,
    playErrorSound,
};
