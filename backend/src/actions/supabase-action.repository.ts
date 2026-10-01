import type { SupabaseClient } from '@supabase/supabase-js';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type { SupabaseService } from '../supabase/supabase.service';
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
  StudentOption,
  StudentOptions,
  UpdateActionInput,
  UpdateItemInput,
  UpdateOptionInput,
} from './action.repository';

export const ACTIONS_TABLE = 'actions';
export const ACTION_OPTIONS_TABLE = 'action_options';
export const ACTION_ITEMS_TABLE = 'action_option_items';
export const PROFILE_ACTIONS_TABLE = 'profile_actions';
export const PROFILE_ITEMS_TABLE = 'profile_option_items';
export const STUDENTS_TABLE = 'students';

interface ActionRow {
  id: string;
  teacher_id: string;
  code: string;
  label: string;
  icon: string | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface OptionRow {
  id: string;
  action_id: string;
  code: string;
  label: string;
  icon: string | null;
  option_type: string | null;
  max_enabled: number | null;
  max_per_page: number | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ItemRow {
  id: string;
  option_id: string;
  label: string;
  icon: string | null;
  level: number | null;
  sort_order: number | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ProfileActionRow {
  profile_id: string;
  action_id: string;
  is_enabled: boolean | null;
}

interface ProfileItemRow {
  profile_id: string;
  item_id: string;
  is_enabled: boolean | null;
  sort_order: number | null;
}

interface StudentRow {
  id: string;
  teacher_id: string;
}

interface RowResponse<T> {
  data: T | null;
  error: unknown;
}

export class SupabaseActionRepository implements ActionRepository {
  constructor(private readonly supabaseService: SupabaseService) {}

  async listActions(teacherId: string): Promise<Action[]> {
    const client = this.requireClient();
    const response = (await client
      .from(ACTIONS_TABLE)
      .select()
      .eq('teacher_id', teacherId)
      .order('sort_order')) as unknown as RowResponse<ActionRow[]>;

    if (response.error || !response.data) return [];

    return response.data.map(mapAction);
  }

  async findAction(
    actionId: string,
    teacherId: string,
  ): Promise<Action | undefined> {
    const client = this.requireClient();
    const response = (await client
      .from(ACTIONS_TABLE)
      .select()
      .eq('id', actionId)
      .eq('teacher_id', teacherId)
      .maybeSingle()) as unknown as RowResponse<ActionRow>;

    if (response.error || !response.data) return undefined;

    return mapAction(response.data);
  }

  async createAction(
    teacherId: string,
    input: CreateActionInput,
  ): Promise<Action> {
    const client = this.requireClient();
    const response = (await client
      .from(ACTIONS_TABLE)
      .insert({
        teacher_id: teacherId,
        code: input.code,
        label: input.label,
        icon: input.icon ?? 'widgets',
        sort_order: input.sortOrder ?? 0,
      })
      .select()
      .single()) as unknown as RowResponse<ActionRow>;

    if (response.error || !response.data) {
      throw persistenceUnavailable();
    }

    return mapAction(response.data);
  }

  async updateAction(
    actionId: string,
    teacherId: string,
    patch: UpdateActionInput,
  ): Promise<Action | undefined> {
    const client = this.requireClient();
    const values: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (patch.label !== undefined) values.label = patch.label;
    if (patch.icon !== undefined) values.icon = patch.icon;
    if (patch.sortOrder !== undefined) values.sort_order = patch.sortOrder;
    if (patch.isActive !== undefined) values.is_active = patch.isActive;

    const response = (await client
      .from(ACTIONS_TABLE)
      .update(values)
      .eq('id', actionId)
      .eq('teacher_id', teacherId)
      .select()
      .maybeSingle()) as unknown as RowResponse<ActionRow>;

    if (response.error || !response.data) return undefined;

    return mapAction(response.data);
  }

  async deactivateAction(
    actionId: string,
    teacherId: string,
  ): Promise<boolean> {
    const client = this.requireClient();
    const response = (await client
      .from(ACTIONS_TABLE)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', actionId)
      .eq('teacher_id', teacherId)
      .eq('is_active', true)
      .select()) as unknown as RowResponse<ActionRow[]>;

    if (response.error) throw persistenceUnavailable();

    return (response.data?.length ?? 0) > 0;
  }

  async listOptions(
    actionId: string,
    teacherId: string,
  ): Promise<ActionOption[] | undefined> {
    const action = await this.findAction(actionId, teacherId);

    if (!action) return undefined;

    const client = this.requireClient();
    const optionsResponse = (await client
      .from(ACTION_OPTIONS_TABLE)
      .select()
      .eq('action_id', actionId)
      .order('sort_order')) as unknown as RowResponse<OptionRow[]>;

    if (optionsResponse.error || !optionsResponse.data) return [];

    const itemsByOption = await this.itemsForOptions(
      client,
      optionsResponse.data.map((option) => option.id),
    );

    return optionsResponse.data.map((option) =>
      mapOption(option, itemsByOption.get(option.id) ?? []),
    );
  }

  async createOption(
    actionId: string,
    teacherId: string,
    input: CreateOptionInput,
  ): Promise<ActionOption | undefined> {
    const action = await this.findAction(actionId, teacherId);

    if (!action) return undefined;

    const client = this.requireClient();
    const response = (await client
      .from(ACTION_OPTIONS_TABLE)
      .insert({
        action_id: actionId,
        code: input.code,
        label: input.label,
        icon: input.icon ?? 'category',
        option_type: input.optionType ?? 'list',
        max_enabled: input.maxEnabled ?? 4,
        max_per_page: input.maxPerPage ?? 6,
        sort_order: input.sortOrder ?? 0,
      })
      .select()
      .single()) as unknown as RowResponse<OptionRow>;

    if (response.error || !response.data) {
      throw persistenceUnavailable();
    }

    return mapOption(response.data, []);
  }

  async updateOption(
    optionId: string,
    teacherId: string,
    patch: UpdateOptionInput,
  ): Promise<ActionOption | undefined> {
    const option = await this.findOptionForTeacher(optionId, teacherId);

    if (!option) return undefined;

    const client = this.requireClient();
    const values: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (patch.label !== undefined) values.label = patch.label;
    if (patch.icon !== undefined) values.icon = patch.icon;
    if (patch.optionType !== undefined) values.option_type = patch.optionType;
    if (patch.maxEnabled !== undefined) values.max_enabled = patch.maxEnabled;
    if (patch.maxPerPage !== undefined) values.max_per_page = patch.maxPerPage;
    if (patch.sortOrder !== undefined) values.sort_order = patch.sortOrder;
    if (patch.isActive !== undefined) values.is_active = patch.isActive;

    const response = (await client
      .from(ACTION_OPTIONS_TABLE)
      .update(values)
      .eq('id', optionId)
      .select()
      .maybeSingle()) as unknown as RowResponse<OptionRow>;

    if (response.error || !response.data) return undefined;

    const items = await this.itemsForOptions(client, [optionId]);

    return mapOption(response.data, items.get(optionId) ?? []);
  }

  async deactivateOption(
    optionId: string,
    teacherId: string,
  ): Promise<boolean> {
    const option = await this.findOptionForTeacher(optionId, teacherId);

    if (!option || !option.is_active) return false;

    const client = this.requireClient();
    const response = (await client
      .from(ACTION_OPTIONS_TABLE)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', optionId)
      .select()) as unknown as RowResponse<OptionRow[]>;

    if (response.error) throw persistenceUnavailable();

    return (response.data?.length ?? 0) > 0;
  }

  async createItem(
    optionId: string,
    teacherId: string,
    input: CreateItemInput,
  ): Promise<ActionOptionItem | undefined> {
    const option = await this.findOptionForTeacher(optionId, teacherId);

    if (!option) return undefined;

    const client = this.requireClient();
    const response = (await client
      .from(ACTION_ITEMS_TABLE)
      .insert({
        option_id: optionId,
        label: input.label,
        icon: input.icon ?? 'star',
        level: input.level ?? 1,
        sort_order: input.sortOrder ?? 0,
      })
      .select()
      .single()) as unknown as RowResponse<ItemRow>;

    if (response.error || !response.data) {
      throw persistenceUnavailable();
    }

    return mapItem(response.data);
  }

  async updateItem(
    itemId: string,
    teacherId: string,
    patch: UpdateItemInput,
  ): Promise<ActionOptionItem | undefined> {
    const item = await this.findItemForTeacher(itemId, teacherId);

    if (!item) return undefined;

    const client = this.requireClient();
    const values: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (patch.label !== undefined) values.label = patch.label;
    if (patch.icon !== undefined) values.icon = patch.icon;
    if (patch.level !== undefined) values.level = patch.level;
    if (patch.sortOrder !== undefined) values.sort_order = patch.sortOrder;
    if (patch.isActive !== undefined) values.is_active = patch.isActive;

    const response = (await client
      .from(ACTION_ITEMS_TABLE)
      .update(values)
      .eq('id', itemId)
      .select()
      .maybeSingle()) as unknown as RowResponse<ItemRow>;

    if (response.error || !response.data) return undefined;

    return mapItem(response.data);
  }

  async deactivateItem(itemId: string, teacherId: string): Promise<boolean> {
    const item = await this.findItemForTeacher(itemId, teacherId);

    if (!item || !item.is_active) return false;

    const client = this.requireClient();
    const response = (await client
      .from(ACTION_ITEMS_TABLE)
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()) as unknown as RowResponse<ItemRow[]>;

    if (response.error) throw persistenceUnavailable();

    return (response.data?.length ?? 0) > 0;
  }

  async getProfileActions(
    profileId: string,
    teacherId: string,
  ): Promise<ProfileActionEntry[]> {
    const actions = await this.listActions(teacherId);

    if (actions.length === 0) return [];

    const client = this.requireClient();
    const response = (await client
      .from(PROFILE_ACTIONS_TABLE)
      .select()
      .eq('profile_id', profileId)) as unknown as RowResponse<
      ProfileActionRow[]
    >;

    const enabled = new Map(
      (response.data ?? []).map((row) => [row.action_id, row.is_enabled]),
    );

    return actions.map((action) => ({
      actionId: action.id,
      code: action.code,
      label: action.label,
      icon: action.icon,
      sortOrder: action.sortOrder,
      isEnabled: enabled.get(action.id) ?? true,
    }));
  }

  async saveProfileActions(
    profileId: string,
    teacherId: string,
    inputs: ProfileActionInput[],
  ): Promise<ProfileActionEntry[] | undefined> {
    const actions = await this.listActions(teacherId);
    const owned = new Set(actions.map((action) => action.id));

    if (inputs.some((input) => !owned.has(input.actionId))) {
      return undefined;
    }

    const client = this.requireClient();
    const response = (await client.from(PROFILE_ACTIONS_TABLE).upsert(
      inputs.map((input) => ({
        profile_id: profileId,
        action_id: input.actionId,
        is_enabled: input.isEnabled,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'profile_id,action_id' },
    )) as unknown as RowResponse<ProfileActionRow[]>;

    if (response.error) throw persistenceUnavailable();

    return this.getProfileActions(profileId, teacherId);
  }

  async getProfileItems(
    profileId: string,
    teacherId: string,
  ): Promise<ProfileItemEntry[]> {
    const catalog = await this.catalogItems(teacherId);

    if (catalog.length === 0) return [];

    const client = this.requireClient();
    const response = (await client
      .from(PROFILE_ITEMS_TABLE)
      .select()
      .eq('profile_id', profileId)) as unknown as RowResponse<ProfileItemRow[]>;

    const state = new Map(
      (response.data ?? []).map((row) => [
        row.item_id,
        { isEnabled: row.is_enabled ?? true, sortOrder: row.sort_order },
      ]),
    );

    return catalog.map((entry) => {
      const profileItem = state.get(entry.item.id);

      return {
        itemId: entry.item.id,
        optionId: entry.option.id,
        optionCode: entry.option.code,
        actionCode: entry.action.code,
        label: entry.item.label,
        icon: entry.item.icon,
        level: entry.item.level,
        sortOrder: profileItem?.sortOrder ?? entry.item.sortOrder,
        isEnabled: profileItem?.isEnabled ?? true,
      };
    });
  }

  async saveProfileItems(
    profileId: string,
    teacherId: string,
    inputs: ProfileItemInput[],
  ): Promise<ProfileItemEntry[] | undefined> {
    const catalog = await this.catalogItems(teacherId);
    const owned = new Set(catalog.map((entry) => entry.item.id));

    if (inputs.some((input) => !owned.has(input.itemId))) {
      return undefined;
    }

    const client = this.requireClient();
    const response = (await client.from(PROFILE_ITEMS_TABLE).upsert(
      inputs.map((input) => ({
        profile_id: profileId,
        item_id: input.itemId,
        is_enabled: input.isEnabled,
        sort_order: input.sortOrder ?? null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: 'profile_id,item_id' },
    )) as unknown as RowResponse<ProfileItemRow[]>;

    if (response.error) throw persistenceUnavailable();

    return this.getProfileItems(profileId, teacherId);
  }

  async getStudentOptions(profileId: string): Promise<StudentOptions> {
    const client = this.requireClient();
    const profileResponse = (await client
      .from(STUDENTS_TABLE)
      .select()
      .eq('id', profileId)
      .maybeSingle()) as unknown as RowResponse<StudentRow>;

    if (profileResponse.error || !profileResponse.data) {
      return { protagonists: [], scenarios: [], missions: [], styles: [] };
    }

    const catalog = await this.catalogItems(profileResponse.data.teacher_id);
    const itemResponse = (await client
      .from(PROFILE_ITEMS_TABLE)
      .select()
      .eq('profile_id', profileId)) as unknown as RowResponse<ProfileItemRow[]>;
    const state = new Map(
      (itemResponse.data ?? []).map((row) => [
        row.item_id,
        { isEnabled: row.is_enabled ?? true, sortOrder: row.sort_order },
      ]),
    );

    const options: StudentOptions = {
      protagonists: [],
      scenarios: [],
      missions: [],
      styles: [],
    };

    for (const entry of catalog) {
      if (entry.action.code !== 'create') continue;
      if (!entry.action.isActive || !entry.option.isActive) continue;
      if (!entry.item.isActive) continue;

      const profileItem = state.get(entry.item.id);

      if (profileItem && !profileItem.isEnabled) continue;

      const target = studentOptionsFor(entry.option.code, options);

      if (!target) continue;

      target.push({
        id: entry.item.id,
        label: entry.item.label,
        icon: entry.item.icon,
        isEnabled: true,
        level: entry.item.level,
        sortOrder: entry.item.sortOrder,
      });
    }

    return options;
  }

  async seedProfileDefaults(
    profileId: string,
    teacherId: string,
  ): Promise<void> {
    const catalog = await this.catalogItems(teacherId);
    const actions = await this.listActions(teacherId);

    if (actions.length === 0) return;

    const client = this.requireClient();
    const actionResponse = (await client.from(PROFILE_ACTIONS_TABLE).upsert(
      actions.map((action) => ({
        profile_id: profileId,
        action_id: action.id,
        is_enabled: true,
      })),
      { onConflict: 'profile_id,action_id', ignoreDuplicates: true },
    )) as unknown as RowResponse<ProfileActionRow[]>;

    if (actionResponse.error) throw persistenceUnavailable();

    if (catalog.length === 0) return;

    const itemResponse = (await client.from(PROFILE_ITEMS_TABLE).upsert(
      catalog.map((entry) => ({
        profile_id: profileId,
        item_id: entry.item.id,
        is_enabled: true,
      })),
      { onConflict: 'profile_id,item_id', ignoreDuplicates: true },
    )) as unknown as RowResponse<ProfileItemRow[]>;

    if (itemResponse.error) throw persistenceUnavailable();
  }

  async syncProfileActions(
    profileId: string,
    teacherId: string,
    modules: ActionModules,
  ): Promise<void> {
    const actions = await this.listActions(teacherId);
    const rows = actions
      .map((action) => {
        const enabled = modules[action.code as keyof ActionModules];

        if (enabled === undefined) return undefined;

        return {
          profile_id: profileId,
          action_id: action.id,
          is_enabled: enabled,
          updated_at: new Date().toISOString(),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== undefined);

    if (rows.length === 0) return;

    const client = this.requireClient();
    const response = (await client.from(PROFILE_ACTIONS_TABLE).upsert(rows, {
      onConflict: 'profile_id,action_id',
    })) as unknown as RowResponse<ProfileActionRow[]>;

    if (response.error) throw persistenceUnavailable();
  }

  private async catalogItems(teacherId: string): Promise<
    Array<{
      action: Action;
      option: ActionOption;
      item: ActionOptionItem;
    }>
  > {
    const actions = await this.listActions(teacherId);

    if (actions.length === 0) return [];

    const client = this.requireClient();
    const optionsResponse = (await client
      .from(ACTION_OPTIONS_TABLE)
      .select()
      .in(
        'action_id',
        actions.map((action) => action.id),
      )) as unknown as RowResponse<OptionRow[]>;

    const options = optionsResponse.data ?? [];

    if (options.length === 0) return [];

    const itemsByOption = await this.itemsForOptions(
      client,
      options.map((option) => option.id),
    );
    const actionById = new Map(actions.map((action) => [action.id, action]));
    const catalog: Array<{
      action: Action;
      option: ActionOption;
      item: ActionOptionItem;
    }> = [];

    for (const optionRow of options) {
      const action = actionById.get(optionRow.action_id);

      if (!action) continue;

      const option = mapOption(
        optionRow,
        itemsByOption.get(optionRow.id) ?? [],
      );

      for (const item of option.items) {
        catalog.push({ action, option, item });
      }
    }

    return catalog;
  }

  private async itemsForOptions(
    client: SupabaseClient,
    optionIds: string[],
  ): Promise<Map<string, ActionOptionItem[]>> {
    const byOption = new Map<string, ActionOptionItem[]>();

    if (optionIds.length === 0) return byOption;

    const response = (await client
      .from(ACTION_ITEMS_TABLE)
      .select()
      .in('option_id', optionIds)
      .order('level')
      .order('sort_order')) as unknown as RowResponse<ItemRow[]>;

    for (const row of response.data ?? []) {
      const list = byOption.get(row.option_id) ?? [];

      list.push(mapItem(row));
      byOption.set(row.option_id, list);
    }

    return byOption;
  }

  private async findOptionForTeacher(
    optionId: string,
    teacherId: string,
  ): Promise<OptionRow | undefined> {
    const client = this.requireClient();
    const response = (await client
      .from(ACTION_OPTIONS_TABLE)
      .select()
      .eq('id', optionId)
      .maybeSingle()) as unknown as RowResponse<OptionRow>;

    if (response.error || !response.data) return undefined;

    const action = await this.findAction(response.data.action_id, teacherId);

    return action ? response.data : undefined;
  }

  private async findItemForTeacher(
    itemId: string,
    teacherId: string,
  ): Promise<ItemRow | undefined> {
    const client = this.requireClient();
    const response = (await client
      .from(ACTION_ITEMS_TABLE)
      .select()
      .eq('id', itemId)
      .maybeSingle()) as unknown as RowResponse<ItemRow>;

    if (response.error || !response.data) return undefined;

    const option = await this.findOptionForTeacher(
      response.data.option_id,
      teacherId,
    );

    return option ? response.data : undefined;
  }

  private requireClient(): SupabaseClient {
    const client = this.supabaseService.getClient();

    if (!client) {
      throw new AiErrorException(
        503,
        'PROVIDER_UNAVAILABLE',
        'Action storage is not configured',
      );
    }

    return client;
  }
}

function studentOptionsFor(
  optionCode: string,
  options: StudentOptions,
): StudentOption[] | undefined {
  switch (optionCode) {
    case 'protagonist':
      return options.protagonists;
    case 'scenario':
      return options.scenarios;
    case 'mission':
      return options.missions;
    case 'style':
      return options.styles;
    default:
      return undefined;
  }
}

function mapAction(row: ActionRow): Action {
  return {
    id: row.id,
    teacherId: row.teacher_id,
    code: row.code,
    label: row.label,
    icon: row.icon ?? 'widgets',
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true,
    createdAt: new Date(row.created_at ?? Date.now()),
    updatedAt: new Date(row.updated_at ?? Date.now()),
  };
}

function mapOption(row: OptionRow, items: ActionOptionItem[]): ActionOption {
  return {
    id: row.id,
    actionId: row.action_id,
    code: row.code,
    label: row.label,
    icon: row.icon ?? 'category',
    optionType: (row.option_type as ActionOption['optionType']) ?? 'list',
    maxEnabled: row.max_enabled ?? 4,
    maxPerPage: row.max_per_page ?? 6,
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true,
    createdAt: new Date(row.created_at ?? Date.now()),
    updatedAt: new Date(row.updated_at ?? Date.now()),
    items,
  };
}

function mapItem(row: ItemRow): ActionOptionItem {
  return {
    id: row.id,
    optionId: row.option_id,
    label: row.label,
    icon: row.icon ?? 'star',
    level: row.level ?? 1,
    sortOrder: row.sort_order ?? 0,
    isActive: row.is_active ?? true,
    createdAt: new Date(row.created_at ?? Date.now()),
    updatedAt: new Date(row.updated_at ?? Date.now()),
  };
}

function persistenceUnavailable(): AiErrorException {
  return new AiErrorException(
    503,
    'PROVIDER_UNAVAILABLE',
    'Action storage is unavailable',
  );
}
