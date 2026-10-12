import { apiFetch } from './backendApi';
import { createIdempotencyKey } from './bookGeneration';
import type { Story } from '../types/database';

export const COMMUNICATION_KINDS = ['feelings', 'help', 'custom'] as const;

export type CommunicationKind = (typeof COMMUNICATION_KINDS)[number];
export type CommunicationAudience = 'child' | 'teen' | 'adult';

export const COMMUNICATION_CELL_COUNTS = [4, 6, 8] as const;

export type CommunicationCellCount =
  (typeof COMMUNICATION_CELL_COUNTS)[number];

export const COMMUNICATION_TOPIC_MAX_LENGTH = 120;

export interface CommunicationGenerationInput {
  kind: CommunicationKind;
  topic: string;
  style: string;
  cellCount: CommunicationCellCount;
  audience?: CommunicationAudience;
  profileId?: string;
}

export interface CommunicationCellPayload {
  label: string;
  imagePrompt?: string;
  imageUrl?: string;
}

export interface CommunicationSummaryPayload {
  id: string;
  title: string;
  kind: string;
  cellCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationDetailPayload {
  id: string;
  title: string;
  kind: string;
  topic: string;
  style: string;
  audience?: string;
  cellCount: number;
  cells: CommunicationCellPayload[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export async function listStudentCommunications(
  profileId: string,
  init: RequestInit = {},
): Promise<CommunicationSummaryPayload[]> {
  return apiFetch<CommunicationSummaryPayload[]>(
    `/api/v1/communications?profileId=${encodeURIComponent(profileId)}`,
    init,
  );
}

export async function getStudentCommunication(
  communicationId: string,
  init: RequestInit = {},
): Promise<CommunicationDetailPayload> {
  return apiFetch<CommunicationDetailPayload>(
    `/api/v1/communications/${encodeURIComponent(communicationId)}`,
    init,
  );
}

export async function requestCommunicationGeneration(
  input: CommunicationGenerationInput,
  init: RequestInit = {},
): Promise<{ jobId: string; status: string }> {
  return apiFetch('/api/v1/ai/communications/generate', {
    ...init,
    method: 'POST',
    headers: { 'Idempotency-Key': createIdempotencyKey(), ...(init.headers ?? {}) },
    body: JSON.stringify(input),
  });
}

export function communicationSummaryToStory(
  summary: CommunicationSummaryPayload,
  studentId: string,
): Story {
  return {
    id: summary.id,
    title: summary.title,
    content: '',
    protagonist: summary.kind,
    scenery: '',
    mission: '',
    style: '',
    image_url: null,
    student_id: studentId,
    type: 'communication',
    created_at: summary.createdAt,
    is_favorite: false,
    dedication_to: null,
    dedication_reason: null,
    dedication_position: null,
  };
}

export function communicationDetailToStory(
  communication: CommunicationDetailPayload,
  studentId: string,
): Story {
  const firstCellWithImage = communication.cells.find(
    (cell) => cell.imageUrl,
  );

  return {
    ...communicationSummaryToStory(
      {
        id: communication.id,
        title: communication.title,
        kind: communication.kind,
        cellCount: communication.cellCount,
        version: communication.version,
        createdAt: communication.createdAt,
        updatedAt: communication.updatedAt,
      },
      studentId,
    ),
    content: communication.cells
      .map((cell, index) => `Celda ${index + 1}: ${cell.label}`)
      .join('\n'),
    style: communication.style,
    image_url: firstCellWithImage?.imageUrl ?? null,
  };
}
