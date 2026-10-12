export type FontSize = 'normal' | 'large' | 'xlarge';
export type LineHeight = 'normal' | 'relaxed' | 'loose';
export type InputMode = 'scan' | 'switch' | 'mouse' | 'touch';
export type VoiceGender = 'female' | 'male' | 'auto';

export const FONT_SIZES: readonly FontSize[] = ['normal', 'large', 'xlarge'];
export const LINE_HEIGHTS: readonly LineHeight[] = [
  'normal',
  'relaxed',
  'loose',
];
export const INPUT_MODES: readonly InputMode[] = [
  'scan',
  'switch',
  'mouse',
  'touch',
];
export const VOICE_GENDERS: readonly VoiceGender[] = ['female', 'male', 'auto'];
