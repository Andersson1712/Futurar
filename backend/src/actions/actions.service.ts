import { Inject, Injectable } from '@nestjs/common';
import { AiErrorException } from '../common/errors/ai-error.exception';
import { ACTION_REPOSITORY } from './action.repository';
import type {
  Action,
  ActionOption,
  ActionOptionItem,
  ActionRepository,
  ProfileItemEntry,
  ProfileItemInput,
} from './action.repository';
import {
  findProfileItemLimitViolations,
  formatLimitViolation,
  toOptionLimitInfo,
} from './limits';
import {
  CreateActionDto,
  CreateItemDto,
  CreateOptionDto,
  UpdateActionDto,
  UpdateItemDto,
  UpdateOptionDto,
} from './dto/action.dto';

@Injectable()
export class ActionsService {
  constructor(
    @Inject(ACTION_REPOSITORY)
    private readonly repository: ActionRepository,
  ) {}

  list(teacherId: string): Promise<Action[]> {
    return this.repository.listActions(teacherId);
  }

  create(teacherId: string, dto: CreateActionDto): Promise<Action> {
    return this.repository.createAction(teacherId, dto);
  }

  async update(
    actionId: string,
    teacherId: string,
    dto: UpdateActionDto,
  ): Promise<Action> {
    const updated = await this.repository.updateAction(
      actionId,
      teacherId,
      dto,
    );

    if (!updated) throw actionNotFound();

    return updated;
  }

  async deactivate(actionId: string, teacherId: string): Promise<void> {
    const deactivated = await this.repository.deactivateAction(
      actionId,
      teacherId,
    );

    if (!deactivated) throw actionNotFound();
  }

  async listOptions(
    actionId: string,
    teacherId: string,
  ): Promise<ActionOption[]> {
    const options = await this.repository.listOptions(actionId, teacherId);

    if (!options) throw actionNotFound();

    return options;
  }

  async createOption(
    actionId: string,
    teacherId: string,
    dto: CreateOptionDto,
  ): Promise<ActionOption> {
    const created = await this.repository.createOption(
      actionId,
      teacherId,
      dto,
    );

    if (!created) throw actionNotFound();

    return created;
  }

  async updateOption(
    optionId: string,
    teacherId: string,
    dto: UpdateOptionDto,
  ): Promise<ActionOption> {
    const updated = await this.repository.updateOption(
      optionId,
      teacherId,
      dto,
    );

    if (!updated) throw optionNotFound();

    return updated;
  }

  async deactivateOption(optionId: string, teacherId: string): Promise<void> {
    const deactivated = await this.repository.deactivateOption(
      optionId,
      teacherId,
    );

    if (!deactivated) throw optionNotFound();
  }

  async createItem(
    optionId: string,
    teacherId: string,
    dto: CreateItemDto,
  ): Promise<ActionOptionItem> {
    const created = await this.repository.createItem(optionId, teacherId, dto);

    if (!created) throw optionNotFound();

    return created;
  }

  async updateItem(
    itemId: string,
    teacherId: string,
    dto: UpdateItemDto,
  ): Promise<ActionOptionItem> {
    const updated = await this.repository.updateItem(itemId, teacherId, dto);

    if (!updated) throw itemNotFound();

    return updated;
  }

  async deactivateItem(itemId: string, teacherId: string): Promise<void> {
    const deactivated = await this.repository.deactivateItem(itemId, teacherId);

    if (!deactivated) throw itemNotFound();
  }

  /**
   * SPEC-023B: enforce `max_enabled` (per option) and `max_per_page` (per level)
   * before persisting per-profile item enablement.
   */
  async saveProfileItems(
    profileId: string,
    teacherId: string,
    inputs: ProfileItemInput[],
  ): Promise<ProfileItemEntry[] | undefined> {
    const [actions, current] = await Promise.all([
      this.repository.listActions(teacherId),
      this.repository.getProfileItems(profileId, teacherId),
    ]);

    const optionsByAction = new Map<string, ActionOption[]>();

    for (const action of actions) {
      optionsByAction.set(
        action.id,
        (await this.repository.listOptions(action.id, teacherId)) ?? [],
      );
    }

    const currentEnabled = new Map(
      current.map((entry) => [entry.itemId, entry.isEnabled]),
    );
    const violations = findProfileItemLimitViolations(
      toOptionLimitInfo(actions, optionsByAction),
      currentEnabled,
      inputs,
    );

    if (violations.length > 0) {
      throw new AiErrorException(
        422,
        'LIMIT_EXCEEDED',
        'Profile item limits exceeded',
        violations.map(formatLimitViolation),
      );
    }

    return this.repository.saveProfileItems(profileId, teacherId, inputs);
  }
}

function actionNotFound(): AiErrorException {
  return new AiErrorException(404, 'NOT_FOUND', 'Action not found');
}

function optionNotFound(): AiErrorException {
  return new AiErrorException(404, 'NOT_FOUND', 'Option not found');
}

function itemNotFound(): AiErrorException {
  return new AiErrorException(404, 'NOT_FOUND', 'Item not found');
}
