import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, NetworkError } from '../services/backendApi';
import {
  getModelCatalog,
  getModelPreference,
  saveModelPreference,
  type ModelCatalog,
} from '../services/backendModels';
import { MESSAGES, messageForErrorCode, t } from '../utils/messages';

interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

const AiModelPanel: React.FC = () => {
  const [catalog, setCatalog] = useState<ModelCatalog | null>(null);
  const [textModel, setTextModel] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [loadedCatalog, preference] = await Promise.all([
        getModelCatalog(),
        getModelPreference(),
      ]);

      setCatalog(loadedCatalog);
      setTextModel(preference.textModel ?? loadedCatalog.defaults.text);
      setImageModel(preference.imageModel ?? loadedCatalog.defaults.image);
      setStatus(null);
    } catch (error) {
      setStatus({ type: 'error', message: describeError(error) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving || !catalog) return;

    setIsSaving(true);

    try {
      const saved = await saveModelPreference({ textModel, imageModel });

      setTextModel(saved.textModel ?? textModel);
      setImageModel(saved.imageModel ?? imageModel);
      setStatus({ type: 'success', message: t('models.saved') });
    } catch (error) {
      setStatus({ type: 'error', message: describeError(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    if (!catalog) return;

    setTextModel(catalog.defaults.text);
    setImageModel(catalog.defaults.image);
    setStatus(null);
  };

  return (
    <section aria-label={t('models.title')} className="max-w-2xl space-y-6">
      <div className="p-5 bg-surface-dark rounded-2xl border border-border-accent">
        <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">
            tune
          </span>
          {t('models.title')}
        </h2>
        <p className="text-sm text-gray-400">{t('models.hint')}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-5 bg-surface-dark rounded-2xl border border-border-accent space-y-4"
      >
        {isLoading ? (
          <p className="text-gray-400">{t('models.loading')}</p>
        ) : catalog ? (
          <>
            <div className="space-y-2">
              <label className="block font-bold" htmlFor="ai-text-model">
                {t('models.textLabel')}
              </label>
              <select
                id="ai-text-model"
                value={textModel}
                onChange={(event) => setTextModel(event.target.value)}
                disabled={isSaving}
                className="w-full min-h-11 bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none disabled:opacity-50"
              >
                {catalog.text.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block font-bold" htmlFor="ai-image-model">
                {t('models.imageLabel')}
              </label>
              <select
                id="ai-image-model"
                value={imageModel}
                onChange={(event) => setImageModel(event.target.value)}
                disabled={isSaving}
                className="w-full min-h-11 bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none disabled:opacity-50"
              >
                {catalog.image.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="min-h-11 px-6 bg-primary hover:bg-primary/80 disabled:opacity-50 rounded-xl font-bold transition-colors"
              >
                {t('models.save')}
              </button>
              <button
                type="button"
                onClick={handleRestoreDefaults}
                disabled={isSaving}
                className="min-h-11 px-6 bg-white/5 hover:bg-white/10 disabled:opacity-50 rounded-xl font-bold transition-colors"
              >
                {t('models.restoreDefaults')}
              </button>
            </div>
          </>
        ) : null}
      </form>

      {status && (
        <p
          role="status"
          aria-live="polite"
          className={`font-medium ${status.type === 'success' ? 'text-green-400' : 'text-red-400'}`}
        >
          {status.message}
        </p>
      )}
    </section>
  );
};

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'UNAUTHORIZED') return t('models.signInRequired');
    if (error.code === 'INVALID_MODEL') return t('models.invalidModel');

    return messageForErrorCode(error.code);
  }

  if (error instanceof NetworkError) return MESSAGES.errors.network;

  return t('models.error');
}

export default AiModelPanel;
