import React, { useState, useEffect } from 'react';
// Force update
import { getAIConfig, upsertAIConfig } from '../services/supabase';
import type { AIConfig } from '../types/database';

interface GlobalConfigModalProps {
    onClose: () => void;
}

interface ProviderInfo {
    id: string;
    name: string;
    description: string;
    isFree: boolean;
    requiredFields: string[];
    models: string[];
    getKeyUrl: string;
}

const PROVIDERS: ProviderInfo[] = [
    {
        id: 'gemini',
        name: 'Google Gemini',
        description: 'IA de Google, con límites generosos',
        isFree: true,
        requiredFields: ['apiKey'],
        models: [
            'gemini-2.0-flash',
            'gemini-2.0-flash-lite-preview-02-05',
            'gemini-2.0-pro-exp-02-05',
            'gemini-2.0-flash-thinking-exp-01-21',
            'gemini-1.5-pro',
            'gemini-1.5-flash',
            // Modelos solicitados (beta/futuros)
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-3.0-flash',
            'gemini-3.0-pro',
        ],
        getKeyUrl: 'https://aistudio.google.com/app/apikey',
    },
    {
        id: 'groq',
        name: 'Groq (Llama 3.1)',
        description: 'Ultra rápido, usa Llama 3.1',
        isFree: true,
        requiredFields: ['apiKey'],
        models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
        getKeyUrl: 'https://console.groq.com/keys',
    },
    {
        id: 'cloudflare',
        name: 'Cloudflare AI',
        description: '10,000 tokens/día',
        isFree: true,
        requiredFields: ['accountId', 'apiKey'],
        models: ['@cf/meta/llama-3.1-8b-instruct', '@cf/mistral/mistral-7b-instruct-v0.1'],
        getKeyUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    },
    {
        id: 'together',
        name: 'Together AI',
        description: 'Modelos open source',
        isFree: true,
        requiredFields: ['apiKey'],
        models: ['meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
        getKeyUrl: 'https://api.together.xyz/settings/api-keys',
    },
    {
        id: 'openai',
        name: 'OpenAI (GPT-4)',
        description: 'Modelos GPT de OpenAI',
        isFree: false,
        requiredFields: ['apiKey'],
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
        getKeyUrl: 'https://platform.openai.com/api-keys',
    },
    {
        id: 'claude',
        name: 'Anthropic Claude',
        description: 'Claude 3.5, alta calidad',
        isFree: false,
        requiredFields: ['apiKey'],
        models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
        getKeyUrl: 'https://console.anthropic.com/settings/keys',
    },
    {
        id: 'freepik',
        name: 'Freepik (Flux/Mystic)',
        description: 'Imágenes generativas de alta calidad',
        isFree: false,
        requiredFields: ['apiKey'],
        models: ['flux-dev', 'flux-schnell', 'mystic', 'classic-fast'],
        getKeyUrl: 'https://freepik.com',
    },
];



const GlobalConfigModal: React.FC<GlobalConfigModalProps> = ({ onClose }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Configuración del proveedor
    const [activeProvider, setActiveProvider] = useState('gemini');
    const [activeImageProvider, setActiveImageProvider] = useState('freepik');
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({
        gemini: '',
        openai: '',
        claude: '',
        groq: '',
        cloudflare_account: '',
        cloudflare_token: '',
        together: '',
        freepik: '',
    });
    const [preferredModel, setPreferredModel] = useState('');
    const [preferredImageModel, setPreferredImageModel] = useState('imagen-4.0-fast-generate-preview-06-06');

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const config = await getAIConfig();
            if (config) {
                setActiveProvider(config.active_provider || 'gemini');
                setActiveImageProvider(config.active_image_provider || (config.freepik_api_key ? 'freepik' : config.active_provider) || 'freepik');
                setPreferredModel(config.preferred_model || '');
                const legacyImageModel = config.preferred_image_model;
                if (!legacyImageModel || legacyImageModel.includes('gemini-3.1') || legacyImageModel.includes('gemini-2.0')) {
                    setPreferredImageModel('imagen-4.0-fast-generate-001');
                } else {
                    setPreferredImageModel(legacyImageModel);
                }
                setApiKeys({
                    gemini: config.gemini_api_key || '',
                    openai: config.openai_api_key || '',
                    claude: config.claude_api_key || '',
                    groq: config.groq_api_key || '',
                    cloudflare_account: config.cloudflare_account_id || '',
                    cloudflare_api_token: config.cloudflare_api_token || '',
                    together: config.together_api_key || '',
                    freepik: config.freepik_api_key || '',
                });
            }
        } catch (error) {
            console.error('Error loading AI config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await upsertAIConfig({
                active_provider: activeProvider,
                active_image_provider: activeImageProvider,
                gemini_api_key: apiKeys.gemini || null,
                openai_api_key: apiKeys.openai || null,
                claude_api_key: apiKeys.claude || null,
                groq_api_key: apiKeys.groq || null,
                cloudflare_account_id: apiKeys.cloudflare_account || null,
                cloudflare_api_token: apiKeys.cloudflare_token || null,
                together_api_key: apiKeys.together || null,
                freepik_api_key: apiKeys.freepik || null,
                preferred_model: preferredModel || null,
                preferred_image_model: preferredImageModel || null,
            });

            // También guardar en localStorage para acceso rápido del frontend
            localStorage.setItem('futurar_ai_config', JSON.stringify({
                activeProvider,
                activeImageProvider,
                apiKeys,
                preferredModel,
                preferredImageModel,
            }));

            // Mostrar mensaje de éxito
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                onClose();
            }, 1500);

        } catch (error) {
            console.error('Error saving config:', error);
        } finally {
            setSaving(false);
        }
    };

    const TEXT_PROVIDERS = PROVIDERS.filter(p => !['freepik'].includes(p.id));
    const IMAGE_PROVIDERS = PROVIDERS.filter(p => ['freepik', 'openai', 'gemini'].includes(p.id));

    const selectedTextProvider = PROVIDERS.find(p => p.id === activeProvider);
    const selectedImageProvider = PROVIDERS.find(p => p.id === activeImageProvider);

    const renderApiKeyField = (providerId: string, providerRequiredFields: string[]) => {
        return (
            <>
                {providerRequiredFields.includes('apiKey') && (
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">
                            API Key
                        </label>
                        <div className="relative">
                            <input
                                type={showKeys[providerId] ? 'text' : 'password'}
                                value={providerId === 'cloudflare' ? apiKeys.cloudflare_token : apiKeys[providerId]}
                                onChange={(e) => setApiKeys(prev => ({
                                    ...prev,
                                    [providerId === 'cloudflare' ? 'cloudflare_token' : providerId]: e.target.value
                                }))}
                                className="w-full bg-background-dark border border-border-accent rounded-lg px-4 py-3 pr-12 text-white font-mono text-sm focus:border-primary focus:outline-none"
                                placeholder="Ingresa tu API Key..."
                            />
                            <button
                                type="button"
                                onClick={() => setShowKeys(prev => ({ ...prev, [providerId]: !prev[providerId] }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
                            >
                                <span className="material-symbols-outlined text-lg">
                                    {showKeys[providerId] ? 'visibility_off' : 'visibility'}
                                </span>
                            </button>
                        </div>
                    </div>
                )}

                {providerRequiredFields.includes('accountId') && (
                    <div>
                        <label className="block text-sm text-gray-400 mb-2">
                            Account ID (Cloudflare)
                        </label>
                        <input
                            type="text"
                            value={apiKeys.cloudflare_account}
                            onChange={(e) => setApiKeys(prev => ({ ...prev, cloudflare_account: e.target.value }))}
                            className="w-full bg-background-dark border border-border-accent rounded-lg px-4 py-3 text-white font-mono text-sm focus:border-primary focus:outline-none"
                            placeholder="Tu Account ID de Cloudflare..."
                        />
                    </div>
                )}
            </>
        )
    }

    const renderProviderTab = () => (
        <div className="space-y-8">
            {/* TEXT PROVIDERS */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">edit_note</span>
                    Generación de Historia (Texto)
                </label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {TEXT_PROVIDERS.map((provider) => (
                        <button
                            key={provider.id}
                            onClick={() => setActiveProvider(provider.id)}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${activeProvider === provider.id
                                ? 'border-primary bg-primary/10'
                                : 'border-border-accent hover:border-gray-500 bg-background-dark/50'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-white">{provider.name}</span>
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-1">{provider.description}</p>
                        </button>
                    ))}
                </div>

                {/* Config Text Provider */}
                {selectedTextProvider && (
                    <div className="p-4 bg-surface-dark rounded-xl border border-border-accent animate-fade-in">
                        <h3 className="font-medium text-white flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-primary">key</span>
                            Configuración de {selectedTextProvider.name}
                        </h3>

                        <div className="space-y-4">
                            {renderApiKeyField(selectedTextProvider.id, selectedTextProvider.requiredFields)}
                            {/* Selector de modelo */}
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">
                                    Modelo (opcional)
                                </label>
                                <select
                                    value={preferredModel}
                                    onChange={(e) => setPreferredModel(e.target.value)}
                                    className="w-full bg-background-dark border border-border-accent rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none"
                                >
                                    <option value="">Modelo por defecto</option>
                                    {selectedTextProvider.models.map((model) => (
                                        <option key={model} value={model}>{model}</option>
                                    ))}
                                </select>
                            </div>
                            <a
                                href={selectedTextProvider.getKeyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                Obtener API Key
                            </a>
                        </div>
                    </div>
                )}
            </div>

            <div className="border-t border-border-accent my-6"></div>

            {/* IMAGE PROVIDERS */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary">image</span>
                    Generación de Ilustraciones (Imágenes)
                </label>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {IMAGE_PROVIDERS.map((provider) => (
                        <button
                            key={`img-${provider.id}`}
                            onClick={() => setActiveImageProvider(provider.id)}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${activeImageProvider === provider.id
                                ? 'border-secondary bg-secondary/10'
                                : 'border-border-accent hover:border-gray-500 bg-background-dark/50'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-white">{provider.name}</span>
                            </div>
                            <p className="text-xs text-gray-400 line-clamp-1">{provider.description}</p>
                        </button>
                    ))}
                </div>

                {/* Config Image Provider */}
                {selectedImageProvider && (
                    <div className="p-4 bg-surface-dark rounded-xl border border-border-accent animate-fade-in">
                        <h3 className="font-medium text-white flex items-center gap-2 mb-4">
                            <span className="material-symbols-outlined text-secondary">key</span>
                            Configuración de {selectedImageProvider.name}
                        </h3>

                        <div className="space-y-4">
                            {renderApiKeyField(selectedImageProvider.id, selectedImageProvider.requiredFields)}

                            {selectedImageProvider.id === 'gemini' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">Modelo de Imagen</label>
                                    <select
                                        value={preferredImageModel || 'imagen-4.0-fast-generate-001'}
                                        onChange={(e) => setPreferredImageModel(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-primary focus:border-transparent"
                                    >
                                        <option value="imagen-4.0-fast-generate-001">Imagen 4 Fast (Balance costo/velocidad)</option>
                                        <option value="imagen-4.0-generate-001">Imagen 4 Standard (Alta Calidad)</option>
                                        <option value="imagen-4.0-ultra-generate-001">Imagen 4 Ultra (Máxima Fidelidad)</option>
                                    </select>
                                    <p className="text-xs text-gray-400 mt-1">Usando la cuota gratuita de AI Studio para Imagen 4 (25 img/día)</p>
                                </div>
                            )}

                            <a
                                href={selectedImageProvider.getKeyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-secondary hover:underline"
                            >
                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                Obtener API Key
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-surface-dark w-full max-w-2xl rounded-2xl border border-border-accent shadow-2xl p-8 text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-400">Cargando configuración...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-surface-dark w-full max-w-2xl rounded-2xl border border-border-accent shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-border-accent flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">tune</span>
                        Configuración de IA
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {renderProviderTab()}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border-accent bg-background-dark/50 flex justify-end gap-3 shrink-0">
                    {showSuccess ? (
                        <div className="flex items-center gap-2 text-green-400 font-medium px-4 py-2 animate-fade-in">
                            <span className="material-symbols-outlined">check_circle</span>
                            ¡Configuración guardada correctamente!
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 hover:bg-white/10 rounded-lg font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2 bg-primary hover:bg-primary/80 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving && <span className="animate-spin">⏳</span>}
                                {saving ? 'Guardando...' : 'Guardar Configuración'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GlobalConfigModal;
