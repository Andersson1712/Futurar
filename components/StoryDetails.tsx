import React, { useState, useEffect, useCallback } from 'react';
import { Story } from '../types/database';
import { supabase } from '../services/supabase';
import { generateStoryPDF } from '../utils/pdfGenerator';
import { speak, speakOption, stopSpeaking } from '../utils/speech';
import { playSelectionSound } from '../utils/audio';

interface StoryDetailsProps {
    story: Story;
    onBack: () => void;
    onRead: () => void;
    onGoMenu: () => void;
    voiceEnabled?: boolean;
    scanInterval?: number;
    soundEnabled?: boolean;
}

interface ActionOption {
    id: string;
    label: string;
    icon: string;
    description: string;
}

const StoryDetails: React.FC<StoryDetailsProps> = ({
    story,
    onBack,
    onRead,
    onGoMenu,
    voiceEnabled = true,
    scanInterval = 3000,
    soundEnabled = true
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [showDedicationModal, setShowDedicationModal] = useState(false);
    const [dedicationText, setDedicationText] = useState('');
    const [dedicationPosition, setDedicationPosition] = useState<'start' | 'end'>('start');
    const [exportStatus, setExportStatus] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [hasSaved, setHasSaved] = useState(false);
    const [scanIndex, setScanIndex] = useState(0);

    // Action options for scanning
    const actionOptions: ActionOption[] = [
        { id: 'read', label: 'Leer Cuento', icon: 'auto_stories', description: 'Leer cuento en voz alta' },
        { id: 'pdf', label: 'Descargar PDF', icon: 'picture_as_pdf', description: 'Descargar como PDF' },
        {
            id: 'save',
            label: hasSaved ? 'Guardado' : 'Guardar',
            icon: hasSaved ? 'check_circle' : 'bookmark_add',
            description: hasSaved ? 'Ya está guardado' : 'Guardar en mi biblioteca'
        },
        { id: 'menu', label: 'Menú Principal', icon: 'home', description: 'Volver al menú principal' },
    ];

    // Check if story already exists in the database on mount
    useEffect(() => {
        const checkAlreadySaved = async () => {
            if (!story.student_id || !story.title) return;
            try {
                const { data } = await supabase
                    .from('stories')
                    .select('id')
                    .eq('student_id', story.student_id)
                    .eq('title', story.title)
                    .limit(1);

                if (data && data.length > 0) {
                    setHasSaved(true);
                }
            } catch (err) {
                // Silently ignore
            }
        };
        checkAlreadySaved();
    }, [story.student_id, story.title]);

    // Scanning timer
    useEffect(() => {
        if (isExporting || isSaving || showDedicationModal) return;

        const timer = setInterval(() => {
            setScanIndex(prev => (prev + 1) % actionOptions.length);
        }, scanInterval);

        return () => clearInterval(timer);
    }, [isExporting, isSaving, showDedicationModal, scanInterval, actionOptions.length]);

    // Announce scanned option
    useEffect(() => {
        if (voiceEnabled && !isExporting && !isSaving && !showDedicationModal) {
            speakOption(actionOptions[scanIndex].description);
        }
    }, [scanIndex, voiceEnabled, isExporting, isSaving, showDedicationModal]);

    // Handle switch press
    useEffect(() => {
        if (showDedicationModal) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                handleSelect(actionOptions[scanIndex].id);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [scanIndex, showDedicationModal, actionOptions]);

    const handleSelect = useCallback((optionId: string) => {
        if (soundEnabled) playSelectionSound();
        stopSpeaking();

        switch (optionId) {
            case 'read':
                onRead();
                break;
            case 'pdf':
                setShowDedicationModal(true);
                break;
            case 'save':
                if (!hasSaved) handleSave();
                break;
            case 'menu':
                onGoMenu();
                break;
        }
    }, [onRead, onGoMenu, hasSaved, soundEnabled]);

    const handleSave = async () => {
        if (isSaving || hasSaved) return;
        setIsSaving(true);
        if (voiceEnabled) speak('Guardando tu cuento en la biblioteca...');

        try {
            const { error } = await supabase.from('stories').insert({
                student_id: story.student_id,
                title: story.title,
                content: story.content,
                protagonist: story.protagonist,
                scenery: story.scenery,
                mission: story.mission,
                style: story.style,
                image_url: story.image_url,
                type: 'story'
            });

            if (error) throw error;

            setHasSaved(true);
            if (voiceEnabled) speak('¡Cuento guardado con éxito!');
        } catch (err) {
            console.error('Error saving story:', err);
            if (voiceEnabled) speak('Hubo un problema al guardar el cuento.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportClick = () => {
        setShowDedicationModal(true);
    };

    const handleGeneratePDF = async () => {
        setIsExporting(true);
        setExportStatus('Iniciando...');
        if (voiceEnabled) speak('Generando tu cuento en PDF, por favor espera un momento.');

        try {
            await generateStoryPDF({
                title: story.title,
                content: story.content || '',
                protagonist: story.protagonist,
                scenery: story.scenery,
                mission: story.mission,
                style: story.style,
                images: story.image_url ? { 0: story.image_url } : {},
                dedication: dedicationText.trim() ? {
                    text: dedicationText,
                    position: dedicationPosition
                } : undefined,
                onProgress: (status) => setExportStatus(status)
            });

            setExportStatus('¡Listo!');
            if (voiceEnabled) speak('Tu PDF ha sido descargado correctamente.');
            setShowDedicationModal(false);
        } catch (error) {
            console.error(error);
            setExportStatus('Error al generar PDF');
            if (voiceEnabled) speak('Hubo un error al generar el PDF.');
        } finally {
            setIsExporting(false);
            setTimeout(() => setExportStatus(''), 3000);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 p-6 md:p-8 animate-fade-in relative">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                    <span>Volver a la Biblioteca</span>
                </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-8 items-center max-w-6xl mx-auto w-full">

                {/* Portada */}
                <div className="w-full md:w-1/3 aspect-[3/4] bg-slate-800 rounded-2xl overflow-hidden shadow-2xl relative group">
                    {story.image_url ? (
                        <img
                            src={story.image_url}
                            alt={story.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                const parent = target.parentElement;
                                if (parent) {
                                    const placeholder = document.createElement('div');
                                    placeholder.className = 'w-full h-full flex items-center justify-center bg-slate-700';
                                    placeholder.innerHTML = '<span class="material-symbols-outlined text-6xl text-slate-500">auto_stories</span>';
                                    parent.insertBefore(placeholder, target);
                                }
                            }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-700">
                            <span className="material-symbols-outlined text-6xl text-slate-500">auto_stories</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                </div>

                {/* Info y Acciones */}
                <div className="w-full md:w-2/3 space-y-6">
                    <div>
                        <h1 className="text-3xl md:text-5xl font-black text-white mb-4 leading-tight">
                            {story.title}
                        </h1>
                        <div className="flex flex-wrap gap-3">
                            <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-bold border border-primary/20">
                                {story.protagonist}
                            </span>
                            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-bold border border-blue-500/20">
                                {story.scenery}
                            </span>
                            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-bold border border-purple-500/20">
                                {story.style}
                            </span>
                        </div>
                    </div>

                    {/* Scanning action buttons */}
                    <div className="space-y-3">
                        {actionOptions.map((option, idx) => {
                            const isActive = idx === scanIndex;
                            const isDisabled = option.id === 'save' && (hasSaved || isSaving);

                            return (
                                <button
                                    key={option.id}
                                    onClick={() => handleSelect(option.id)}
                                    disabled={isDisabled && !isActive}
                                    className={`
                                        w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 relative overflow-hidden
                                        ${isActive
                                            ? 'bg-primary border-2 border-white shadow-[0_0_40px_rgba(19,127,236,0.5)] scale-[1.02]'
                                            : option.id === 'save' && hasSaved
                                                ? 'bg-green-900/30 border border-green-700/50 opacity-60'
                                                : 'bg-slate-800/60 border border-slate-700/50 opacity-40'
                                        }
                                    `}
                                >
                                    <div className={`
                                        size-12 rounded-full flex items-center justify-center shrink-0
                                        ${isActive ? 'bg-white/20' : 'bg-slate-900/50'}
                                    `}>
                                        <span className={`material-symbols-outlined text-2xl ${isActive ? 'text-white'
                                                : option.id === 'save' && hasSaved ? 'text-green-400'
                                                    : 'text-primary'
                                            }`}>
                                            {option.icon}
                                        </span>
                                    </div>
                                    <span className={`text-lg font-bold ${isActive ? 'text-white' : 'text-gray-300'}`}>
                                        {option.label}
                                    </span>

                                    {isActive && (
                                        <>
                                            <div className="ml-auto">
                                                <span className="material-symbols-outlined text-white animate-pulse">check_circle</span>
                                            </div>
                                            {/* Scan progress bar */}
                                            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
                                                <div
                                                    className="h-full bg-white scan-progress-bar"
                                                    style={{ '--scan-duration': `${scanInterval}ms` } as React.CSSProperties}
                                                />
                                            </div>
                                        </>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Mission details */}
                    <div className="p-5 bg-white/5 rounded-2xl border border-white/10">
                        <h3 className="text-lg font-bold text-gray-300 mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-yellow-500">lightbulb</span>
                            Detalles de la Misión
                        </h3>
                        <p className="text-gray-400">
                            {story.mission}
                        </p>
                    </div>
                </div>
            </div>

            {/* Bottom hint */}
            <div className="text-center mt-4">
                <p className="text-xs text-gray-500">
                    Presiona tu pulsador para seleccionar
                </p>
            </div>

            {/* Modal de Dedicatoria */}
            {showDedicationModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">favorite</span>
                                Agregar Dedicatoria
                            </h2>
                            <button
                                onClick={() => setShowDedicationModal(false)}
                                className="text-gray-400 hover:text-white"
                                disabled={isExporting}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">
                                    Mensaje especial
                                </label>
                                <textarea
                                    value={dedicationText}
                                    onChange={(e) => setDedicationText(e.target.value)}
                                    placeholder="Para mi querido..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary min-h-[120px]"
                                    disabled={isExporting}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-3">
                                    Posición en el cuento
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setDedicationPosition('start')}
                                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${dedicationPosition === 'start'
                                            ? 'bg-primary/20 border-primary text-white'
                                            : 'bg-slate-800 border-slate-700 text-gray-400 hover:bg-slate-750'
                                            }`}
                                        disabled={isExporting}
                                    >
                                        <div className="w-8 h-10 border-2 border-current rounded-sm flex flex-col p-1 gap-1">
                                            <div className="w-full h-1 bg-current rounded-full"></div>
                                            <div className="w-2/3 h-1 bg-current/50 rounded-full"></div>
                                        </div>
                                        <span className="font-bold">Al Inicio</span>
                                    </button>

                                    <button
                                        onClick={() => setDedicationPosition('end')}
                                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${dedicationPosition === 'end'
                                            ? 'bg-primary/20 border-primary text-white'
                                            : 'bg-slate-800 border-slate-700 text-gray-400 hover:bg-slate-750'
                                            }`}
                                        disabled={isExporting}
                                    >
                                        <div className="w-8 h-10 border-2 border-current rounded-sm flex flex-col-reverse p-1 gap-1">
                                            <div className="w-full h-1 bg-current rounded-full"></div>
                                            <div className="w-2/3 h-1 bg-current/50 rounded-full"></div>
                                        </div>
                                        <span className="font-bold">Al Final</span>
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleGeneratePDF}
                                disabled={isExporting}
                                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${isExporting
                                    ? 'bg-gray-600 cursor-wait'
                                    : 'bg-white text-slate-900 hover:bg-gray-100 hover:scale-[1.02]'
                                    }`}
                            >
                                {isExporting ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                        {exportStatus || 'Generando...'}
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">download</span>
                                        Descargar PDF
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoryDetails;
