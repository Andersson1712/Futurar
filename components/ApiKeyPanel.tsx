import React, { useCallback, useEffect, useState } from 'react';
import { ApiError, NetworkError } from '../services/backendApi';
import {
  listCredentials,
  revokeCredential,
  saveCredential,
  type CredentialMetadata,
} from '../services/backendCredentials';
import { MESSAGES, messageForErrorCode, t } from '../utils/messages';

interface StatusMessage {
  type: 'success' | 'error';
  message: string;
}

const ApiKeyPanel: React.FC = () => {
  const [credentials, setCredentials] = useState<CredentialMetadata[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<StatusMessage | null>(null);

  const refresh = useCallback(async () => {
    try {
      setCredentials(await listCredentials());
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

  const active = credentials.find((item) => item.status === 'active');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSaving || apiKey.trim().length < 20) return;

    setIsSaving(true);

    try {
      await saveCredential('gemini', apiKey.trim());
      setApiKey('');
      await refresh();
      setStatus({ type: 'success', message: t('credentials.saved') });
    } catch (error) {
      setStatus({ type: 'error', message: describeError(error) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevoke = async () => {
    setIsSaving(true);

    try {
      await revokeCredential('gemini');
      await refresh();
      setStatus({ type: 'success', message: t('credentials.revoked') });
    } catch (error) {
      setStatus({ type: 'error', message: describeError(error) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section
      aria-label={t('credentials.title')}
      className="max-w-2xl space-y-6"
    >
      <div className="p-5 bg-surface-dark rounded-2xl border border-border-accent">
        <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">key</span>
          {t('credentials.title')}
        </h2>
        <p className="text-sm text-gray-400">{t('credentials.hint')}</p>

        {isLoading ? (
          <p className="mt-4 text-gray-400">{t('credentials.loading')}</p>
        ) : active ? (
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-400">{t('credentials.status')}</dt>
            <dd className="font-bold text-green-400">{t('credentials.active')}</dd>
            <dt className="text-gray-400">{t('credentials.hintLabel')}</dt>
            <dd className="font-mono">••••{active.keyHint}</dd>
            <dt className="text-gray-400">{t('credentials.updated')}</dt>
            <dd>{new Date(active.updatedAt).toLocaleString('es-AR')}</dd>
          </dl>
        ) : (
          <p className="mt-4 text-gray-400">{t('credentials.none')}</p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-5 bg-surface-dark rounded-2xl border border-border-accent space-y-4"
      >
        <label className="block font-bold" htmlFor="api-key-input">
          {active ? t('credentials.rotate') : t('credentials.save')}
        </label>
        <input
          id="api-key-input"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={t('credentials.placeholder')}
          className="w-full min-h-11 bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isSaving || apiKey.trim().length < 20}
            className="min-h-11 px-6 bg-primary hover:bg-primary/80 disabled:opacity-50 rounded-xl font-bold transition-colors"
          >
            {active ? t('credentials.rotate') : t('credentials.save')}
          </button>
          {active && (
            <button
              type="button"
              onClick={handleRevoke}
              disabled={isSaving}
              className="min-h-11 px-6 bg-red-500/20 hover:bg-red-500/30 text-red-300 disabled:opacity-50 rounded-xl font-bold transition-colors"
            >
              {t('credentials.revoke')}
            </button>
          )}
        </div>
      </form>

      {status && (
        <p
          role="status"
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
    if (error.code === 'UNAUTHORIZED') return t('credentials.signInRequired');
    if (error.code === 'PROVIDER_UNAVAILABLE') {
      return t('credentials.disabled');
    }

    return messageForErrorCode(error.code);
  }

  if (error instanceof NetworkError) return MESSAGES.errors.network;

  return MESSAGES.errors.generic;
}

export default ApiKeyPanel;
