import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Action,
  ActionModules,
  ActionOption,
  ActionOptionItem,
  ActionRepository,
  CreateActionInput,
  CreateItemInput,
  CreateOptionInput,
  ProfileActionEntry,
  ProfileActionInput,
  ProfileItemEntry,
  ProfileItemInput,
  StudentOptions,
  UpdateActionInput,
  UpdateItemInput,
  UpdateOptionInput,
} from './action.repository';
import {
  INTRO_ACTIONS,
  INTRO_ITEMS,
  INTRO_OPTIONS,
} from './intro-catalog.seed';

interface ProfileItemState {
  isEnabled: boolean;
  sortOrder?: number;
}

@Injectable()
export class InMemoryActionRepository implements ActionRepository {
  private readonly actions = new Map<string, Action>();
  private readonly options = new Map<string, ActionOption>();
  private readonly items = new Map<string, ActionOptionItem>();
  private readonly profileActions = new Map<string, Map<string, boolean>>();
  private readonly profileItems = new Map<
    string,
    Map<string, ProfileItemState>
  >();

  listActions(teacherId: string): Promise<Action[]> {
    return Promise.resolve(
      [...this.actions.values()]
        .filter((action) => action.teacherId === teacherId)
        .sort(byAction),
    );
  }

  findAction(actionId: string, teacherId: string): Promise<Action | undefined> {
    const action = this.actions.get(actionId);

    return Promise.resolve(
      action && action.teacherId === teacherId ? action : undefined,
    );
  }

  createAction(teacherId: string, input: CreateActionInput): Promise<Action> {
    const now = new Date();
    const action: Action = {
      id: randomUUID(),
      teacherId,
      code: input.code,
      label: input.label,
      icon: input.icon ?? 'widgets',
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.actions.set(action.id, action);

    return Promise.resolve(action);
  }

  updateAction(
    actionId: string,
    teacherId: string,
    patch: UpdateActionInput,
  ): Promise<Action | undefined> {
    const action = this.actions.get(actionId);

    if (!action || action.teacherId !== teacherId) {
      return Promise.resolve(undefined);
    }

    Object.assign(action, stripUndefined(patch), { updatedAt: new Date() });

    return Promise.resolve(action);
  }

  deactivateAction(actionId: string, teacherId: string): Promise<boolean> {
    const action = this.actions.get(actionId);

    if (!action || action.teacherId !== teacherId || !action.isActive) {
      return Promise.resolve(false);
    }

    action.isActive = false;
    action.updatedAt = new Date();

    return Promise.resolve(true);
  }

  listOptions(
    actionId: string,
    teacherId: string,
  ): Promise<ActionOption[] | undefined> {
    const action = this.actions.get(actionId);

    if (!action || action.teacherId !== teacherId) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve(this.optionsForAction(actionId));
  }

  createOption(
    actionId: string,
    teacherId: string,
    input: CreateOptionInput,
  ): Promise<ActionOption | undefined> {
    const action = this.actions.get(actionId);

    if (!action || action.teacherId !== teacherId) {
      return Promise.resolve(undefined);
    }

    const now = new Date();
    const option: ActionOption = {
      id: randomUUID(),
      actionId,
      code: input.code,
      label: input.label,
      icon: input.icon ?? 'category',
      optionType: input.optionType ?? 'list',
      maxEnabled: input.maxEnabled ?? 4,
      maxPerPage: input.maxPerPage ?? 6,
      sortOrder: input.sortOrder ?? 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      items: [],
    };

    this.options.set(option.id, option);

    return Promise.resolve(option);
  }

  updateOption(
    optionId: string,
    teacherId: string,
    patch: UpdateOptionInput,
  ): Promise<ActionOption | undefined> {
    const option = this.options.get(optionId);

    if (!option || !this.ownsOption(option, teacherId)) {
      return Promise.resolve(undefined);
    }

    Object.assign(option, stripUndefined(patch), { updatedAt: new Date() });

    return Promise.resolve(option);
  }

  deactivateOption(optionId: string, teacherId: string): Promise<boolean> {
    const option = this.options.get(optionId);

    if (!option || !this.ownsOption(option, teacherId) || !option.isActive) {
      return Promise.resolve(false);
    }

    option.isActive = false;
    option.updatedAt = new Date();

    return Promise.resolve(true);
  }

  createItem(
    optionId: string,
    teacherId: string,
    input: CreateItemInput,
  ): Promise<ActionOptionItem | undefined> {
    const option = this.options.get(optionId);

    if (!option || !this.ownsOption(option, teacherId)) {
      return Promise.resolve(undefined);
    }

    const now = new Date();
    const item: ActionOptionItem = {
      id: randomUUID(),
      optionId,
      label: input.label,
      icon: input.icon ?? 'star',
      level: input.level ?? 1,
      sortOrder: input.sortOrder ?? this.itemsForOption(optionId).length + 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.items.set(item.id, item);

    return Promise.resolve(item);
  }

  updateItem(
    itemId: string,
    teacherId: string,
    patch: UpdateItemInput,
  ): Promise<ActionOptionItem | undefined> {
    const item = this.items.get(itemId);

    if (!item || !this.ownsItem(item, teacherId)) {
      return Promise.resolve(undefined);
    }

    Object.assign(item, stripUndefined(patch), { updatedAt: new Date() });

    return Promise.resolve(item);
  }

  deactivateItem(itemId: string, teacherId: string): Promise<boolean> {
    const item = this.items.get(itemId);

    if (!item || !this.ownsItem(item, teacherId) || !item.isActive) {
      return Promise.resolve(false);
    }

    item.isActive = false;
    item.updatedAt = new Date();

    return Promise.resolve(true);
  }

  getProfileActions(
    profileId: string,
    teacherId: string,
  ): Promise<ProfileActionEntry[]> {
    const state =
      this.profileActions.get(profileId) ?? new Map<string, boolean>();

    return this.listActions(teacherId).then((actions) =>
      actions.map((action) => ({
        actionId: action.id,
        code: action.code,
        label: action.label,
        icon: action.icon,
        sortOrder: action.sortOrder,
        isEnabled: state.get(action.id) ?? true,
      })),
    );
  }

  saveProfileActions(
    profileId: string,
    teacherId: string,
    inputs: ProfileActionInput[],
  ): Promise<ProfileActionEntry[] | undefined> {
    const owned = new Set(
      [...this.actions.values()]
        .filter((action) => action.teacherId === teacherId)
        .map((action) => action.id),
    );

    if (inputs.some((input) => !owned.has(input.actionId))) {
      return Promise.resolve(undefined);
    }

    const state =
      this.profileActions.get(profileId) ?? new Map<string, boolean>();

    for (const input of inputs) {
      state.set(input.actionId, input.isEnabled);
    }

    this.profileActions.set(profileId, state);

    return this.getProfileActions(profileId, teacherId);
  }

  getProfileItems(
    profileId: string,
    teacherId: string,
  ): Promise<ProfileItemEntry[]> {
    const state =
      this.profileItems.get(profileId) ?? new Map<string, ProfileItemState>();
    const entries: ProfileItemEntry[] = [];

    for (const action of this.actions.values()) {
      if (action.teacherId !== teacherId) continue;

      for (const option of this.optionsForAction(action.id)) {
        for (const item of this.itemsForOption(option.id)) {
          const profileItem = state.get(item.id);

          entries.push({
            itemId: item.id,
            optionId: option.id,
            optionCode: option.code,
            actionCode: action.code,
            label: item.label,
            icon: item.icon,
            level: item.level,
            sortOrder: profileItem?.sortOrder ?? item.sortOrder,
            isEnabled: profileItem?.isEnabled ?? true,
          });
        }
      }
    }

    return Promise.resolve(entries);
  }

  saveProfileItems(
    profileId: string,
    teacherId: string,
    inputs: ProfileItemInput[],
  ): Promise<ProfileItemEntry[] | undefined> {
    const owned = new Set<string>();

    for (const action of this.actions.values()) {
      if (action.teacherId !== teacherId) continue;

      for (const option of this.optionsForAction(action.id)) {
        for (const item of this.itemsForOption(option.id)) {
          owned.add(item.id);
        }
      }
    }

    if (inputs.some((input) => !owned.has(input.itemId))) {
      return Promise.resolve(undefined);
    }

    const state =
      this.profileItems.get(profileId) ?? new Map<string, ProfileItemState>();

    for (const input of inputs) {
      const current = state.get(input.itemId);

      state.set(input.itemId, {
        isEnabled: input.isEnabled,
        sortOrder: input.sortOrder ?? current?.sortOrder,
      });
    }

    this.profileItems.set(profileId, state);

    return this.getProfileItems(profileId, teacherId);
  }

  getStudentOptions(profileId: string): Promise<StudentOptions> {
    const state =
      this.profileItems.get(profileId) ?? new Map<string, ProfileItemState>();

    return Promise.resolve({
      protagonists: this.studentOptionsFor('protagonist', state),
      scenarios: this.studentOptionsFor('scenario', state),
      missions: this.studentOptionsFor('mission', state),
      styles: this.studentOptionsFor('style', state),
    });
  }

  async ensureTeacherCatalog(teacherId: string): Promise<void> {
    const existing = await this.listActions(teacherId);

    if (existing.length > 0) return;

    const created: Action[] = [];

    for (const seed of INTRO_ACTIONS) {
      created.push(
        await this.createAction(teacherId, {
          code: seed.code,
          label: seed.label,
          icon: seed.icon,
          sortOrder: seed.sortOrder,
        }),
      );
    }

    const create = created.find((action) => action.code === 'create');

    if (!create) return;

    const optionIds = new Map<string, string>();

    for (const seed of INTRO_OPTIONS) {
      const option = await this.createOption(create.id, teacherId, {
        code: seed.code,
        label: seed.label,
        icon: seed.icon,
        sortOrder: seed.sortOrder,
      });

      if (option) optionIds.set(seed.code, option.id);
    }

    for (const seed of INTRO_ITEMS) {
      const optionId = optionIds.get(seed.optionCode);

      if (!optionId) continue;

      const siblings = this.itemsForOption(optionId);

      if (siblings.some((sibling) => sibling.label === seed.label)) continue;

      await this.createItem(optionId, teacherId, {
        label: seed.label,
        icon: seed.icon,
        level: seed.level,
        sortOrder: seed.sortOrder,
      });
    }
  }

  async seedProfileDefaults(
    profileId: string,
    teacherId: string,
  ): Promise<void> {
    await this.ensureTeacherCatalog(teacherId);

    const actionState =
      this.profileActions.get(profileId) ?? new Map<string, boolean>();
    const itemState =
      this.profileItems.get(profileId) ?? new Map<string, ProfileItemState>();

    for (const action of this.actions.values()) {
      if (action.teacherId !== teacherId) continue;

      if (!actionState.has(action.id)) actionState.set(action.id, true);

      for (const option of this.optionsForAction(action.id)) {
        // SPEC-023C quota seeding: each profile starts with exactly
        // `maxEnabled` items enabled per option — first by `level`, then
        // `sortOrder`, ties broken by label for determinism — and every
        // other item explicitly disabled. Explicit rows (never implicit
        // enablement) keep later saves within quota from day one.
        const ranked = [...this.itemsForOption(option.id)].sort(
          (a, b) =>
            a.level - b.level ||
            a.sortOrder - b.sortOrder ||
            a.label.localeCompare(b.label),
        );

        ranked.forEach((item, index) => {
          if (!itemState.has(item.id)) {
            itemState.set(item.id, {
              isEnabled: index < option.maxEnabled,
            });
          }
        });
      }
    }

    this.profileActions.set(profileId, actionState);
    this.profileItems.set(profileId, itemState);
  }

  syncProfileActions(
    profileId: string,
    teacherId: string,
    modules: ActionModules,
  ): Promise<void> {
    const state =
      this.profileActions.get(profileId) ?? new Map<string, boolean>();

    for (const action of this.actions.values()) {
      if (action.teacherId !== teacherId) continue;

      const enabled = modules[action.code as keyof ActionModules];

      if (enabled !== undefined) state.set(action.id, enabled);
    }

    this.profileActions.set(profileId, state);

    return Promise.resolve();
  }

  /** Test helper: seed a catalog row directly. */
  seedCatalog(teacherId: string, catalog: Action[]): void {
    for (const action of catalog) {
      this.actions.set(action.id, action);
    }
  }

  private ownsOption(option: ActionOption, teacherId: string): boolean {
    const action = this.actions.get(option.actionId);

    return action?.teacherId === teacherId;
  }

  private ownsItem(item: ActionOptionItem, teacherId: string): boolean {
    const option = this.options.get(item.optionId);

    return option ? this.ownsOption(option, teacherId) : false;
  }

  private optionsForAction(actionId: string): ActionOption[] {
    return [...this.options.values()]
      .filter((option) => option.actionId === actionId)
      .sort(byOption)
      .map((option) => ({
        ...option,
        items: this.itemsForOption(option.id),
      }));
  }

  private itemsForOption(optionId: string): ActionOptionItem[] {
    return [...this.items.values()]
      .filter((item) => item.optionId === optionId)
      .sort(byItem);
  }

  private studentOptionsFor(
    optionCode: string,
    state: Map<string, ProfileItemState>,
  ) {
    const options: StudentOptions['protagonists'] = [];

    for (const action of this.actions.values()) {
      if (!action.isActive || action.code !== 'create') continue;

      for (const option of this.optionsForAction(action.id)) {
        if (option.code !== optionCode || !option.isActive) continue;

        for (const item of option.items) {
          if (!item.isActive) continue;

          const profileItem = state.get(item.id);

          if (profileItem && !profileItem.isEnabled) continue;

          options.push({
            id: item.id,
            label: item.label,
            icon: item.icon,
            isEnabled: true,
            level: item.level,
            sortOrder: item.sortOrder,
          });
        }
      }
    }

    return options;
  }
}

function byAction(a: Action, b: Action): number {
  return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
}

function byOption(a: ActionOption, b: ActionOption): number {
  return a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
}

function byItem(a: ActionOptionItem, b: ActionOptionItem): number {
  return a.level - b.level || a.sortOrder - b.sortOrder;
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
