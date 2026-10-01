import { useEffect } from 'react';
import {
  applyAccessibilityToDocument,
  type AccessibilitySettings,
} from '../utils/accessibility';
import { configureSpeechVoice } from '../utils/speech';

/**
 * Applies the active profile accessibility settings to the document (root font
 * size, line height, uppercase, bold titles) and configures the TTS voice.
 * SPEC-015: settings come from the selected student profile.
 */
export function useAccessibility(settings: AccessibilitySettings | null): void {
  useEffect(() => {
    if (!settings) return;

    applyAccessibilityToDocument(settings);
    configureSpeechVoice({ gender: settings.voiceGender });
  }, [settings]);
}

export default useAccessibility;
