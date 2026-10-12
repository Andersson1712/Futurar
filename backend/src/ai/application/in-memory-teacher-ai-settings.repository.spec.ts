import { InMemoryTeacherAiSettingsRepository } from './in-memory-teacher-ai-settings.repository';

describe('InMemoryTeacherAiSettingsRepository (SPEC-033B)', () => {
  it('returns undefined for an owner without a stored preference', async () => {
    const repository = new InMemoryTeacherAiSettingsRepository();

    await expect(repository.get('teacher-1')).resolves.toBeUndefined();
  });

  it('creates a row and reads it back', async () => {
    const repository = new InMemoryTeacherAiSettingsRepository();

    const saved = await repository.upsert('teacher-1', {
      textModel: 'google/gemini-3.8-flash',
      imageModel: 'openai/gpt-image-2',
    });

    expect(saved).toMatchObject({
      ownerId: 'teacher-1',
      textModel: 'google/gemini-3.8-flash',
      imageModel: 'openai/gpt-image-2',
    });
    expect(saved.updatedAt).toBeInstanceOf(Date);
    await expect(repository.get('teacher-1')).resolves.toMatchObject({
      textModel: 'google/gemini-3.8-flash',
      imageModel: 'openai/gpt-image-2',
    });
  });

  it('keeps the other field when a partial update omits it', async () => {
    const repository = new InMemoryTeacherAiSettingsRepository();

    await repository.upsert('teacher-1', {
      textModel: 'google/gemini-3.8-flash',
      imageModel: 'openai/gpt-image-2',
    });
    await repository.upsert('teacher-1', {
      imageModel: 'qwen/qwen-image-3-pro',
    });

    await expect(repository.get('teacher-1')).resolves.toMatchObject({
      textModel: 'google/gemini-3.8-flash',
      imageModel: 'qwen/qwen-image-3-pro',
    });
  });

  it('isolates preferences per owner', async () => {
    const repository = new InMemoryTeacherAiSettingsRepository();

    await repository.upsert('teacher-1', { imageModel: 'openai/gpt-image-2' });

    await expect(repository.get('teacher-2')).resolves.toBeUndefined();
  });
});
