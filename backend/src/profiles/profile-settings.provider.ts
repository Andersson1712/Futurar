import type { Audience, StorySize } from '../ai/domain/book-generation.types';

export const PROFILE_SETTINGS_PROVIDER = Symbol('PROFILE_SETTINGS_PROVIDER');

export interface BookDefaults {
  storySize?: StorySize;
  audience?: Audience;
}

export interface ProfileSettingsProvider {
  getBookDefaults(profileId: string): Promise<BookDefaults>;
}
