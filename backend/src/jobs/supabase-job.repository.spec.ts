import type { SupabaseClient } from '@supabase/supabase-js';
import { AiErrorException } from '../common/errors/ai-error.exception';
import type { SupabaseService } from '../supabase/supabase.service';
import type { GenerateBookRequestDto } from '../ai/dto/generate-book-request.dto';
import { SupabaseJobRepository } from './supabase-job.repository';

const REQUEST: GenerateBookRequestDto = {
  protagonist: 'Un dragón',
  scenery: 'Un bosque',
  mission: 'Encontrar la estrella',
  style: 'Acuarela',
  storySize: 'small',
};

const ROW = {
  id: 'job-1',
  user_id: 'user-1',
  profile_id: null,
  status: 'queued',
  request: REQUEST,
  book: null,
  error: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function buildRepository(options: { client?: unknown } = {}) {
  const maybeSingle = jest.fn();
  const userEq = jest.fn(() => ({ maybeSingle }));
  const idEq = jest.fn(() => ({ eq: userEq, maybeSingle }));
  const select = jest.fn(() => ({ eq: idEq }));
  const single = jest.fn();
  const insert = jest.fn(() => ({ select: jest.fn(() => ({ single })) }));
  const updateEq = jest.fn();
  const update = jest.fn(() => ({ eq: updateEq }));
  const from = jest.fn(() => ({ insert, select, update }));
  const client = { from } as unknown as SupabaseClient;
  const supabaseService = {
    getClient: () => ('client' in options ? options.client : client),
  } as unknown as SupabaseService;

  return {
    repository: new SupabaseJobRepository(supabaseService),
    from,
    insert,
    update,
    updateEq,
    maybeSingle,
    single,
    idEq,
  };
}

describe('SupabaseJobRepository', () => {
  it('creates rows with queued status and maps them back', async () => {
    const { repository, insert, single, from } = buildRepository();
    single.mockResolvedValue({ data: ROW, error: null });

    const job = await repository.create({ userId: 'user-1', request: REQUEST });

    expect(from).toHaveBeenCalledWith('generation_jobs');
    expect(insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      profile_id: null,
      status: 'queued',
      request: REQUEST,
    });
    expect(job).toMatchObject({
      id: 'job-1',
      userId: 'user-1',
      status: 'queued',
      request: REQUEST,
    });
    expect(job.createdAt).toBeInstanceOf(Date);
  });

  it('finds jobs by id and user', async () => {
    const { repository, maybeSingle, idEq } = buildRepository();
    maybeSingle.mockResolvedValue({ data: ROW, error: null });

    const job = await repository.find('job-1', 'user-1');

    expect(idEq).toHaveBeenCalledWith('id', 'job-1');
    expect(job?.id).toBe('job-1');
  });

  it('returns undefined when the row is missing', async () => {
    const { repository, maybeSingle } = buildRepository();
    maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(repository.findById('missing')).resolves.toBeUndefined();
  });

  it('updates status through markProcessing, complete and fail', async () => {
    const { repository, update, updateEq } = buildRepository();
    updateEq.mockResolvedValue({ error: null });

    await repository.markProcessing('job-1');
    await repository.complete('job-1', {
      title: 'Cuento',
      totalPages: 1,
      pages: [{ pageNumber: 1, content: 'Había una vez' }],
    });
    await repository.fail('job-1', {
      statusCode: 502,
      code: 'INVALID_OUTPUT',
      message: 'bad',
    });

    expect(update).toHaveBeenCalledTimes(3);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('fails with 503 when Supabase is not configured', async () => {
    const { repository } = buildRepository({ client: null });

    const error = await repository
      .create({ userId: 'user-1', request: REQUEST })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiErrorException);
    expect((error as AiErrorException).getStatus()).toBe(503);
  });
});
