import type { Audience, StorySize } from '../ai/domain/book-generation.types';
import type {
  FontSize,
  InputMode,
  LineHeight,
  VoiceGender,
} from './profile-settings.types';

export const PROFILE_REPOSITORY = Symbol('PROFILE_REPOSITORY');

export interface ProfileModules {
  create: boolean;
  library: boolean;
  design: boolean;
}

export interface ProfileSettings {
  scanInterval: number;
  scanColumns: number;
  voiceFeedback: boolean;
  soundEnabled: boolean;
  sweepEnabled: boolean;
  inputMode: InputMode;
  lineHeight: LineHeight;
  boldTitles: boolean;
  uppercase: boolean;
  voiceGender: VoiceGender;
  fontSize: FontSize;
  modules: ProfileModules;
  bookStorySize: StorySize;
  bookAudience: Audience;
}

export interface Profile {
  id: string;
  teacherId: string;
  name: string;
  age?: number;
  birthdate?: string;
  avatarIcon: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  settings?: ProfileSettings;
}

export interface CreateProfileInput {
  name: string;
  age?: number;
  birthdate?: string;
  avatarIcon?: string;
  notes?: string;
}

export interface UpdateProfileInput {
  name?: string;
  age?: number;
  birthdate?: string;
  avatarIcon?: string;
  notes?: string;
  isActive?: boolean;
}

export interface ProfileOption {
  id: string;
  label: string;
  icon: string;
  isEnabled: boolean;
  level: number;
  sortOrder: number;
}

export interface ProfileOptions {
  protagonists: ProfileOption[];
  scenarios: ProfileOption[];
  missions: ProfileOption[];
  styles: ProfileOption[];
}

export const DEFAULT_PROFILE_MODULES: ProfileModules = {
  create: true,
  library: true,
  design: true,
};

export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  scanInterval: 3000,
  scanColumns: 2,
  voiceFeedback: true,
  soundEnabled: true,
  sweepEnabled: true,
  inputMode: 'scan',
  lineHeight: 'normal',
  boldTitles: false,
  uppercase: false,
  voiceGender: 'auto',
  fontSize: 'normal',
  modules: DEFAULT_PROFILE_MODULES,
  bookStorySize: 'medium',
  bookAudience: 'child',
};

export interface ProfileRepository {
  list(teacherId: string, activeOnly: boolean): Promise<Profile[]>;
  findById(profileId: string, teacherId: string): Promise<Profile | undefined>;
  create(teacherId: string, input: CreateProfileInput): Promise<Profile>;
  update(
    profileId: string,
    teacherId: string,
    patch: UpdateProfileInput,
  ): Promise<Profile | undefined>;
  deactivate(profileId: string, teacherId: string): Promise<boolean>;
  getSettings(profileId: string): Promise<ProfileSettings | undefined>;
  saveSettings(
    profileId: string,
    settings: ProfileSettings,
  ): Promise<ProfileSettings>;
}
