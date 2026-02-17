import React, { useState, useEffect } from 'react';
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
        description: 'IA de Google, gratis con límites generosos',
        isFree: true,
        requiredFields: ['apiKey'],
        models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
        getKeyUrl: 'https://aistudio.google.com/app/apikey',
    },
    {
        id: 'groq',
        name: 'Groq (Llama 3.1)',
        description: 'Ultra rápido, gratuito, usa Llama 3.1',
        isFree: true,
        requiredFields: ['apiKey'],
        models: ['llama-3.1-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
        getKeyUrl: 'https://console.groq.com/keys',
    },
    {
        id: 'cloudflare',
        name: 'Cloudflare AI',
        description: 'Gratis, 10,000 tokens/día',
        isFree: true,
        requiredFields: ['accountId', 'apiKey'],
        models: ['@cf/meta/llama-3.1-8b-instruct', '@cf/mistral/mistral-7b-instruct-v0.1'],
        getKeyUrl: 'https://dash.cloudflare.com/profile/api-tokens',
    },
    {
        id: 'together',
        name: 'Together AI',
        description: 'Tier gratuito, modelos open source',
        isFree: true,
        requiredFields: ['apiKey'],
        models: ['meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
        getKeyUrl: 'https://api.together.xyz/settings/api-keys',
    },
    {
        id: 'openai',
        name: 'OpenAI (GPT-4)',
        description: 'Modelos GPT de OpenAI, de pago',
        isFree: false,
        requiredFields: ['apiKey'],
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
        getKeyUrl: 'https://platform.openai.com/api-keys',
    },
    {
        id: 'claude',
        name: 'Anthropic Claude',
        description: 'Claude 3.5, alta calidad, de pago',
        isFree: false,
        requiredFields: ['apiKey'],
        models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest'],
        getKeyUrl: 'https://console.anthropic.com/settings/keys',
    },
];

const STORY_SIZES = [
    { id: 'small', name: 'Pequeño', pages: 5, description: 'Ideal para niños pequeños o lecturas rápidas' },
    { id: 'medium', name: 'Mediano', pages: 10, description: 'Desarrollo completo de la historia' },
    { id: 'large', name: 'Grande', pages: 15, description: 'Cuento extenso con muchos detalles' },
];

const GlobalConfigModal: React.FC<GlobalConfigModalProps> = ({ onClose }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'provider' | 'story'>('provider');

    // Configuración del proveedor
    const [activeProvider, setActiveProvider] = useState('gemini');
    const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
    const [apiKeys, setApiKeys] = useState<Record<string, string>>({
        gemini: '',
        openai: '',
        claude: '',
        groq: '',
        cloudflare_account: '',
        cloudflare_token: '',
        together: '',
    });
    const [preferredModel, setPreferredModel] = useState('');

    // Configuración del cuento
    const [storySize, setStorySize] = useState<'small' | 'medium' | 'large'>('medium');
    const [customStructure, setCustomStructure] = useState('');

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const config = await getAIConfig();
            if (config) {
                setActiveProvider(config.active_provider || 'gemini');
                setStorySize(config.story_size || 'medium');
                setCustomStructure(config.custom_story_structure || '');
                setPreferredModel(config.preferred_model || '');
                setApiKeys({
                    gemini: config.gemini_api_key || '',
                    openai: config.openai_api_key || '',
                    claude: config.claude_api_key || '',
                    groq: config.groq_api_key || '',
                    cloudflare_account: config.cloudflare_account_id || '',
                    cloudflare_token: config.cloudflare_api_token || '',
                    together: config.together_api_key || '',
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
                gemini_api_key: apiKeys.gemini || null,
                openai_api_key: apiKeys.openai || null,
                claude_api_key: apiKeys.claude || null,
                groq_api_key: apiKeys.groq || null,
                cloudflare_account_id: apiKeys.cloudflare_account || null,
                cloudflare_api_token: apiKeys.cloudflare_token || null,
                together_api_key: apiKeys.together || null,
                preferred_model: preferredModel || null,
                story_size: storySize,
                custom_story_structure: customStructure || null,
            });

            // También guardar en localStorage para acceso rápido del frontend
            localStorage.setItem('futurar_ai_config', JSON.stringify({
                activeProvider,
                apiKeys,
                preferredModel,
                storySize,
                customStructure,
            }));

            alert('¡Configuración guardada correctamente!');
            onClose();
        } catch (error) {
            console.error('Error saving config:', error);
            alert('Error al guardar la configuración. Intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    const selectedProvider = PROVIDERS.find(p => p.id === activeProvider);

    const renderProviderTab = () => (
        <div className="space-y-6">
            {/* Selector de proveedor */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                    Proveedor de IA
                </label>
                <div className="grid grid-cols-2 gap-3">
                    {PROVIDERS.map((provider) => (
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
                                <span className={`text-xs px-2 py-0.5 rounded-full ${provider.isFree
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                    {provider.isFree ? 'Gratis' : 'Pago'}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400">{provider.description}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Campos de configuración del proveedor seleccionado */}
            {selectedProvider && (
                <div className="space-y-4 p-4 bg-surface-dark rounded-xl border border-border-accent">
                    <h3 className="font-medium text-white flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">key</span>
                        Configuración de {selectedProvider.name}
                    </h3>

                    {selectedProvider.requiredFields.includes('apiKey') && (
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">
                                API Key
                            </label>
                            <div className="relative">
                                <input
                                    type={showKeys[activeProvider] ? 'text' : 'password'}
                                    value={activeProvider === 'cloudflare' ? apiKeys.cloudflare_token : apiKeys[activeProvider]}
                                    onChange={(e) => setApiKeys(prev => ({
                                        ...prev,
                                        [activeProvider === 'cloudflare' ? 'cloudflare_token' : activeProvider]: e.target.value
                                    }))}
                                    className="w-full bg-background-dark border border-border-accent rounded-lg px-4 py-3 pr-12 text-white font-mono text-sm focus:border-primary focus:outline-none"
                                    placeholder="Ingresa tu API Key..."
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowKeys(prev => ({ ...prev, [activeProvider]: !prev[activeProvider] }))}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
                                >
                                    <span className="material-symbols-outlined text-lg">
                                        {showKeys[activeProvider] ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {selectedProvider.requiredFields.includes('accountId') && (
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
                            {selectedProvider.models.map((model) => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    </div>

                    <a
                        href={selectedProvider.getKeyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        Obtener API Key de {selectedProvider.name}
                    </a>
                </div>
            )}
        </div>
    );

    const renderStoryTab = () => (
        <div className="space-y-6">
            {/* Tamaño del cuento */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                    Tamaño del Cuento
                </label>
                <div className="grid grid-cols-3 gap-3">
                    {STORY_SIZES.map((size) => (
                        <button
                            key={size.id}
                            onClick={() => setStorySize(size.id as 'small' | 'medium' | 'large')}
                            className={`p-4 rounded-xl border-2 text-center transition-all ${storySize === size.id
                                ? 'border-primary bg-primary/10'
                                : 'border-border-accent hover:border-gray-500 bg-background-dark/50'
                                }`}
                        >
                            <div className="text-3xl mb-2">
                                {size.id === 'small' ? '📖' : size.id === 'medium' ? '📚' : '📕'}
                            </div>
                            <div className="font-medium text-white">{size.name}</div>
                            <div className="text-2xl font-bold text-primary">{size.pages}</div>
                            <div className="text-xs text-gray-400">páginas</div>
                        </button>
                    ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">
                    {STORY_SIZES.find(s => s.id === storySize)?.description}
                </p>
            </div>

            {/* Estructura personalizada */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Estructura Personalizada del Cuento
                    <span className="text-gray-500 font-normal ml-2">(opcional)</span>
                </label>
                <p className="text-xs text-gray-500 mb-3">
                    Describe cómo quieres que se estructure el cuento. Esto se aplicará además de la
                    selección de protagonista, escenario y misión.
                </p>
                <textarea
                    value={customStructure}
                    onChange={(e) => setCustomStructure(e.target.value)}
                    className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none resize-none"
                    rows={5}
                    placeholder="Ejemplo: 
- Inicia con una introducción mágica
- Incluye un compañero animal para el protagonista  
- Agrega un momento de suspenso antes del clímax
- Termina con una moraleja sobre la amistad"
                />
                <p className="mt-2 text-xs text-gray-500">
                    Puedes especificar el tono, elementos narrativos, tipo de final, o cualquier
                    instrucción especial para la generación del cuento.
                </p>
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
                        Configuración de IA y Cuentos
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border-accent shrink-0">
                    <button
                        onClick={() => setActiveTab('provider')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'provider'
                            ? 'text-primary border-b-2 border-primary bg-primary/5'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined text-xl">smart_toy</span>
                        Proveedor de IA
                    </button>
                    <button
                        onClick={() => setActiveTab('story')}
                        className={`flex-1 px-6 py-3 font-medium transition-colors flex items-center justify-center gap-2 ${activeTab === 'story'
                            ? 'text-primary border-b-2 border-primary bg-primary/5'
                            : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined text-xl">auto_stories</span>
                        Configuración de Cuentos
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {activeTab === 'provider' ? renderProviderTab() : renderStoryTab()}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border-accent bg-background-dark/50 flex justify-end gap-3 shrink-0">
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
                </div>
            </div>
        </div>
    );
};

export default GlobalConfigModal;
