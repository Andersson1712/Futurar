import React, { useState, useEffect } from 'react';
import { updateStudentSettings } from '../services/supabase';
import type { StudentSettings } from '../types/database';
import ConnectionStatus from './ConnectionStatus';

interface SettingsPanelProps {
    settings: StudentSettings | null;
    studentId: string;
    studentName: string;
    onBack: () => void;
    onSettingsChange?: (settings: StudentSettings) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
    settings,
    studentId,
    studentName,
    onBack,
    onSettingsChange
}) => {
    const [localSettings, setLocalSettings] = useState<Partial<StudentSettings>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    useEffect(() => {
        if (settings) {
            setLocalSettings(settings);
        }
    }, [settings]);

    const handleChange = <K extends keyof StudentSettings>(
        key: K,
        value: StudentSettings[K]
    ) => {
        setLocalSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveMessage(null);

        try {
            const updated = await updateStudentSettings(studentId, localSettings);
            onSettingsChange?.(updated);
            setSaveMessage('✓ Configuración guardada');
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (error) {
            console.error('Error guardando configuración:', error);
            setSaveMessage('✗ Error al guardar');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-4xl font-black">Configuración</h2>
                    <p className="text-gray-400 mt-1">Personalizar experiencia para {studentName}</p>
                </div>
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                    Volver
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Configuración de Escaneo */}
                <div className="bg-surface-dark/50 rounded-2xl p-6 border border-border-accent">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">timer</span>
                        Escaneo
                    </h3>

                    <div className="space-y-4">
                        {/* Intervalo de escaneo */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Velocidad de escaneo
                            </label>
                            <select
                                value={localSettings.scan_interval || 3000}
                                onChange={(e) => handleChange('scan_interval', Number(e.target.value))}
                                className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                            >
                                <option value={2000}>Rápido (2 segundos)</option>
                                <option value={3000}>Normal (3 segundos)</option>
                                <option value={4000}>Lento (4 segundos)</option>
                                <option value={5000}>Muy lento (5 segundos)</option>
                                <option value={7000}>Extra lento (7 segundos)</option>
                            </select>
                        </div>

                        {/* Columnas */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Columnas en la grilla
                            </label>
                            <select
                                value={localSettings.scan_columns || 2}
                                onChange={(e) => handleChange('scan_columns', Number(e.target.value))}
                                className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                            >
                                <option value={1}>1 columna (más grande)</option>
                                <option value={2}>2 columnas</option>
                                <option value={3}>3 columnas</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Configuración de Audio */}
                <div className="bg-surface-dark/50 rounded-2xl p-6 border border-border-accent">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">volume_up</span>
                        Audio
                    </h3>

                    <div className="space-y-4">
                        {/* Sonido habilitado */}
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-gray-300">Sonido de selección</span>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={localSettings.sound_enabled ?? true}
                                    onChange={(e) => handleChange('sound_enabled', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-14 h-8 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                            </div>
                        </label>

                        {/* Retroalimentación por voz */}
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-gray-300">Leer opciones en voz alta</span>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    checked={localSettings.voice_feedback ?? false}
                                    onChange={(e) => handleChange('voice_feedback', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-14 h-8 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* Configuración Visual */}
                <div className="bg-surface-dark/50 rounded-2xl p-6 border border-border-accent">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">palette</span>
                        Visual
                    </h3>

                    <div className="space-y-4">
                        {/* Tema */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Tema de colores
                            </label>
                            <select
                                value={localSettings.theme || 'dark'}
                                onChange={(e) => handleChange('theme', e.target.value)}
                                className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                            >
                                <option value="dark">Oscuro (predeterminado)</option>
                                <option value="light">Claro</option>
                                <option value="high_contrast">Alto contraste</option>
                            </select>
                        </div>

                        {/* Tamaño de fuente */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Tamaño de texto
                            </label>
                            <select
                                value={localSettings.font_size || 'large'}
                                onChange={(e) => handleChange('font_size', e.target.value)}
                                className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                            >
                                <option value="normal">Normal</option>
                                <option value="large">Grande</option>
                                <option value="extra_large">Extra grande</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Configuración de Contenido */}
                <div className="bg-surface-dark/50 rounded-2xl p-6 border border-border-accent">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">auto_stories</span>
                        Contenido
                    </h3>

                    <div className="space-y-4">
                        {/* Límite de historias por día */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Historias máximas por día
                            </label>
                            <select
                                value={localSettings.max_stories_per_day || 5}
                                onChange={(e) => handleChange('max_stories_per_day', Number(e.target.value))}
                                className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                            >
                                <option value={3}>3 historias</option>
                                <option value={5}>5 historias</option>
                                <option value={10}>10 historias</option>
                                <option value={999}>Sin límite</option>
                            </select>
                        </div>

                        {/* Filtro de contenido */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Filtro de contenido
                            </label>
                            <select
                                value={localSettings.content_filter_level || 'strict'}
                                onChange={(e) => handleChange('content_filter_level', e.target.value)}
                                className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                            >
                                <option value="strict">Estricto (recomendado)</option>
                                <option value="moderate">Moderado</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Estado de Conexión USB */}
                <div className="md:col-span-2">
                    <ConnectionStatus />
                </div>
            </div>

            {/* Botón guardar */}
            <div className="mt-8 flex items-center justify-between">
                <div className="text-lg font-medium">
                    {saveMessage && (
                        <span className={saveMessage.includes('✓') ? 'text-green-400' : 'text-red-400'}>
                            {saveMessage}
                        </span>
                    )}
                </div>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-8 py-4 bg-primary hover:bg-primary/80 rounded-2xl font-black text-xl flex items-center gap-2 transition-colors disabled:opacity-50"
                >
                    {isSaving ? (
                        <>
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                            Guardando...
                        </>
                    ) : (
                        <>
                            <span className="material-symbols-outlined">save</span>
                            Guardar Configuración
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default SettingsPanel;
