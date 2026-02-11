export interface ScanOption {
  id: string;
  label: string;
  icon: string;
  image?: string;
  description?: string;
}

export enum AppStep {
  PROFILE = 'PROFILE',
  MENU = 'MENU',
  SELECT_PROTAGONIST = 'SELECT_PROTAGONIST',
  SELECT_SCENERY = 'SELECT_SCENERY',
  SELECT_MISSION = 'SELECT_MISSION',
  SELECT_STYLE = 'SELECT_STYLE',
  GENERATING = 'GENERATING',
  RESULT_VIEW = 'RESULT_VIEW',
  LIBRARY = 'LIBRARY',
  LIBRARY_ITEM_OPTIONS = 'LIBRARY_ITEM_OPTIONS',
  READ_STORY = 'READ_STORY',
  DEDICATE_RECIPIENT = 'DEDICATE_RECIPIENT',
  DEDICATE_REASON = 'DEDICATE_REASON',
  DEDICATE_POSITION = 'DEDICATE_POSITION',
  SETTINGS = 'SETTINGS',
  TEACHER_PANEL = 'TEACHER_PANEL'
}

export interface StoryConfig {
  id?: string;
  title?: string;
  protagonist: string;
  scenery: string;
  mission: string;
  style: string;
  content?: string;
  imageUrl?: string;
  type: 'story' | 'design';
  date?: string;
  studentId?: string;
}

export interface DedicationConfig {
  to: string;
  reason: string;
  position: 'start' | 'end';
}

// Configuración de accesibilidad para escaneo
export interface ScanConfig {
  interval: number;       // Intervalo de escaneo en ms
  columns: number;        // Columnas en la grilla
  soundEnabled: boolean;  // Sonido al seleccionar
  voiceFeedback: boolean; // Lectura en voz alta
}

// Tema visual
export type ThemeMode = 'dark' | 'light' | 'high_contrast';
export type FontSize = 'normal' | 'large' | 'extra_large';
