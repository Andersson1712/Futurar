export const ACTION_REPOSITORY = Symbol('ACTION_REPOSITORY');

export const OPTION_TYPES = ['list', 'image', 'text'] as const;
export type OptionType = (typeof OPTION_TYPES)[number];

export interface Action {
  id: string;
  teacherId: string;
  code: string;
  label: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActionOptionItem {
  id: string;
  optionId: string;
  label: string;
  icon: string;
  level: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActionOption {
  id: string;
  actionId: string;
  code: string;
  label: string;
  icon: string;
  optionType: OptionType;
  maxEnabled: number;
  maxPerPage: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  items: ActionOptionItem[];
}

export interface ActionModules {
  create: boolean;
  library: boolean;
  design: boolean;
}

export interface ProfileActionEntry {
  actionId: string;
  code: string;
  label: string;
  icon: string;
  sortOrder: number;
  isEnabled: boolean;
}

export interface ProfileItemEntry {
  itemId: string;
  optionId: string;
  optionCode: string;
  actionCode: string;
  label: string;
  icon: string;
  level: number;
  sortOrder: number;
  isEnabled: boolean;
}

export interface StudentOption {
  id: string;
  label: string;
  icon: string;
  isEnabled: boolean;
  level: number;
  sortOrder: number;
}

export interface StudentOptions {
  protagonists: StudentOption[];
  scenarios: StudentOption[];
  missions: StudentOption[];
  styles: StudentOption[];
}

export interface CreateActionInput {
  code: string;
  label: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateActionInput {
  label?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateOptionInput {
  code: string;
  label: string;
  icon?: string;
  optionType?: OptionType;
  maxEnabled?: number;
  maxPerPage?: number;
  sortOrder?: number;
}

export interface UpdateOptionInput {
  label?: string;
  icon?: string;
  optionType?: OptionType;
  maxEnabled?: number;
  maxPerPage?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateItemInput {
  label: string;
  icon?: string;
  level?: number;
  sortOrder?: number;
}

export interface UpdateItemInput {
  label?: string;
  icon?: string;
  level?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ProfileActionInput {
  actionId: string;
  isEnabled: boolean;
}

export interface ProfileItemInput {
  itemId: string;
  isEnabled: boolean;
  sortOrder?: number;
}

export interface ActionRepository {
  listActions(teacherId: string): Promise<Action[]>;
  findAction(actionId: string, teacherId: string): Promise<Action | undefined>;
  createAction(teacherId: string, input: CreateActionInput): Promise<Action>;
  updateAction(
    actionId: string,
    teacherId: string,
    patch: UpdateActionInput,
  ): Promise<Action | undefined>;
  deactivateAction(actionId: string, teacherId: string): Promise<boolean>;

  listOptions(
    actionId: string,
    teacherId: string,
  ): Promise<ActionOption[] | undefined>;
  createOption(
    actionId: string,
    teacherId: string,
    input: CreateOptionInput,
  ): Promise<ActionOption | undefined>;
  updateOption(
    optionId: string,
    teacherId: string,
    patch: UpdateOptionInput,
  ): Promise<ActionOption | undefined>;
  deactivateOption(optionId: string, teacherId: string): Promise<boolean>;
  createItem(
    optionId: string,
    teacherId: string,
    input: CreateItemInput,
  ): Promise<ActionOptionItem | undefined>;
  updateItem(
    itemId: string,
    teacherId: string,
    patch: UpdateItemInput,
  ): Promise<ActionOptionItem | undefined>;
  deactivateItem(itemId: string, teacherId: string): Promise<boolean>;

  getProfileActions(
    profileId: string,
    teacherId: string,
  ): Promise<ProfileActionEntry[]>;
  saveProfileActions(
    profileId: string,
    teacherId: string,
    inputs: ProfileActionInput[],
  ): Promise<ProfileActionEntry[] | undefined>;
  getProfileItems(
    profileId: string,
    teacherId: string,
  ): Promise<ProfileItemEntry[]>;
  saveProfileItems(
    profileId: string,
    teacherId: string,
    inputs: ProfileItemInput[],
  ): Promise<ProfileItemEntry[] | undefined>;
  getStudentOptions(profileId: string): Promise<StudentOptions>;
  seedProfileDefaults(profileId: string, teacherId: string): Promise<void>;
  syncProfileActions(
    profileId: string,
    teacherId: string,
    modules: ActionModules,
  ): Promise<void>;
}
