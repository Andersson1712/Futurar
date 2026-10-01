import { apiFetch } from './backendApi';

export type OptionType = 'list' | 'image' | 'text';

export interface ActionPayload {
  id: string;
  teacherId: string;
  code: string;
  label: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActionOptionItemPayload {
  id: string;
  optionId: string;
  label: string;
  icon: string;
  level: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActionOptionPayload {
  id: string;
  actionId: string;
  code: string;
  label: string;
  icon: string;
  optionType: OptionType;
  maxEnabled: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: ActionOptionItemPayload[];
}

export interface ProfileActionPayload {
  actionId: string;
  code: string;
  label: string;
  icon: string;
  sortOrder: number;
  isEnabled: boolean;
}

export interface ProfileItemPayload {
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

export interface ActionInput {
  code: string;
  label: string;
  icon?: string;
  sortOrder?: number;
}

export interface ActionPatch {
  label?: string;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface OptionInput {
  code: string;
  label: string;
  icon?: string;
  optionType?: OptionType;
  maxEnabled?: number;
  sortOrder?: number;
}

export interface OptionPatch {
  label?: string;
  icon?: string;
  optionType?: OptionType;
  maxEnabled?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ItemInput {
  label: string;
  icon?: string;
  level?: number;
  sortOrder?: number;
}

export interface ItemPatch {
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

export async function listActions(): Promise<ActionPayload[]> {
  return apiFetch<ActionPayload[]>('/api/v1/actions');
}

export async function createAction(
  input: ActionInput,
): Promise<ActionPayload> {
  return apiFetch<ActionPayload>('/api/v1/actions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAction(
  actionId: string,
  patch: ActionPatch,
): Promise<ActionPayload> {
  return apiFetch<ActionPayload>(
    `/api/v1/actions/${encodeURIComponent(actionId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
}

export async function deleteAction(actionId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/actions/${encodeURIComponent(actionId)}`, {
    method: 'DELETE',
  });
}

export async function listActionOptions(
  actionId: string,
): Promise<ActionOptionPayload[]> {
  return apiFetch<ActionOptionPayload[]>(
    `/api/v1/actions/${encodeURIComponent(actionId)}/options`,
  );
}

export async function createActionOption(
  actionId: string,
  input: OptionInput,
): Promise<ActionOptionPayload> {
  return apiFetch<ActionOptionPayload>(
    `/api/v1/actions/${encodeURIComponent(actionId)}/options`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function updateActionOption(
  optionId: string,
  patch: OptionPatch,
): Promise<ActionOptionPayload> {
  return apiFetch<ActionOptionPayload>(
    `/api/v1/options/${encodeURIComponent(optionId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
}

export async function deleteActionOption(optionId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/options/${encodeURIComponent(optionId)}`, {
    method: 'DELETE',
  });
}

export async function createActionItem(
  optionId: string,
  input: ItemInput,
): Promise<ActionOptionItemPayload> {
  return apiFetch<ActionOptionItemPayload>(
    `/api/v1/options/${encodeURIComponent(optionId)}/items`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function updateActionItem(
  itemId: string,
  patch: ItemPatch,
): Promise<ActionOptionItemPayload> {
  return apiFetch<ActionOptionItemPayload>(
    `/api/v1/items/${encodeURIComponent(itemId)}`,
    { method: 'PATCH', body: JSON.stringify(patch) },
  );
}

export async function deleteActionItem(itemId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  });
}

export async function listProfileActions(
  profileId: string,
): Promise<ProfileActionPayload[]> {
  return apiFetch<ProfileActionPayload[]>(
    `/api/v1/profiles/${encodeURIComponent(profileId)}/actions`,
  );
}

export async function saveProfileActions(
  profileId: string,
  actions: ProfileActionInput[],
): Promise<ProfileActionPayload[]> {
  return apiFetch<ProfileActionPayload[]>(
    `/api/v1/profiles/${encodeURIComponent(profileId)}/actions`,
    { method: 'PUT', body: JSON.stringify({ actions }) },
  );
}

export async function listProfileItems(
  profileId: string,
): Promise<ProfileItemPayload[]> {
  return apiFetch<ProfileItemPayload[]>(
    `/api/v1/profiles/${encodeURIComponent(profileId)}/items`,
  );
}

export async function saveProfileItems(
  profileId: string,
  items: ProfileItemInput[],
): Promise<ProfileItemPayload[]> {
  return apiFetch<ProfileItemPayload[]>(
    `/api/v1/profiles/${encodeURIComponent(profileId)}/items`,
    { method: 'PUT', body: JSON.stringify({ items }) },
  );
}
