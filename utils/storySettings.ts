export type StorySize = 'small' | 'medium' | 'large';

export interface StorySettings {
  storySize: StorySize;
  customStructure: string;
}

export const STORY_SETTINGS_STORAGE_KEY = 'futurar_story_config';

export const DEFAULT_STORY_SETTINGS: StorySettings = {
  storySize: 'medium',
  customStructure: '',
};

export function loadStorySettings(): StorySettings {
  try {
    const stored = localStorage.getItem(STORY_SETTINGS_STORAGE_KEY);

    if (!stored) return DEFAULT_STORY_SETTINGS;

    const parsed = JSON.parse(stored) as Partial<StorySettings>;

    return {
      storySize:
        parsed.storySize === 'small' || parsed.storySize === 'large'
          ? parsed.storySize
          : 'medium',
      customStructure: parsed.customStructure || '',
    };
  } catch {
    return DEFAULT_STORY_SETTINGS;
  }
}

export function saveStorySettings(settings: StorySettings): void {
  localStorage.setItem(STORY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function clearStorySettings(): void {
  localStorage.removeItem(STORY_SETTINGS_STORAGE_KEY);
}
