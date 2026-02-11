import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { playSelectionSound } from '../utils/audio';
import { speak, stopSpeaking, speakOption } from '../utils/speech';
import { getChapterImage } from '../utils/images';
import { generateStoryPDF } from '../utils/pdfGenerator';

type StoryReaderProps = {
    title: string;
    content: string;
    protagonist: string;
    scenery: string;
    mission: string;
    style: string;
    onClose: () => void;
    studentId?: string;
    onRead: (text: string) => void;
    voiceEnabled?: boolean;
    onCreateAnother?: () => void;
    onSaveSuccess?: () => void;
    scanInterval?: number;
};

interface ActionOption {
    id: string;
    label: string;
    icon: string;
}

interface Chapter {
    title: string;
    content: string;
    imageUrl: string;
}

const actionOptions: ActionOption[] = [
    { id: 'read', label: 'Leer', icon: 'volume_up' },
    { id: 'save', label: 'Guardar', icon: 'bookmark' }, // TODO: Check if already saved?
    { id: 'pdf', label: 'PDF', icon: 'picture_as_pdf' },
    { id: 'new', label: 'Otro', icon: 'restart_alt' },
    { id: 'home', label: 'Salir', icon: 'home' }
];

const getChapterImageForStory = (scenery: string, chapterNum: number): string => {
    return getChapterImage(scenery, chapterNum);
};

const parseChapters = (content: string, scenery: string): Chapter[] => {
    // Ensure we don't have empty sections
    const sections = content.split(/CAPÍTULO \d+[:]?\s?/i).filter(s => s.trim().length > 20);
    const titles = content.match(/CAPÍTULO \d+[:]?\s?[^\n]*/gi) || [];

    return sections.map((section, idx) => ({
        title: titles[idx] || `Capítulo ${idx + 1}`,
        content: section.trim(),
        imageUrl: getChapterImageForStory(scenery, idx + 1)
    }));
};

const stripMarkdown = (text: string): string => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
        .replace(/\*(.*?)\*/g, '$1') // Italic
        .replace(/#(.*?)\n/g, '$1') // Titles
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
        .replace(/`/g, ''); // Code
};

const getExcerpt = (content: string) => {
    const clean = stripMarkdown(content);
    return clean.substring(0, 150) + '...';
};

const StoryReader: React.FC<StoryReaderProps> = ({
    title,
    content,
    protagonist,
    scenery,
    mission,
    style,
    onClose,
    studentId,
    onRead,
    voiceEnabled = true,
    onCreateAnother,
    onSaveSuccess,
    scanInterval = 3000
}) => {
    const [scanIndex, setScanIndex] = useState(0);
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const hasSelectedRef = useRef(false);
    const [pdfProgress, setPdfProgress] = useState<string>('');

    // Parse chapters logic
    useEffect(() => {
        if (content && scenery) {
            setChapters(parseChapters(content, scenery));
            if (voiceEnabled) {
                setTimeout(() => {
                    speak('¡Cuento listo! ¿Qué deseas hacer?');
                }, 1000);
            }
        }
    }, [content, scenery, voiceEnabled]);

    // Barrido automático
    useEffect(() => {
        if (isGeneratingPDF || isSaving) return;

        const timer = setInterval(() => {
            setScanIndex((prev) => (prev + 1) % actionOptions.length);
        }, scanInterval);

        return () => clearInterval(timer);
    }, [isGeneratingPDF, isSaving, scanInterval]);

    // Anunciar opción
    useEffect(() => {
        if (voiceEnabled && !isGeneratingPDF && !isSaving) {
            const currentOption = actionOptions[scanIndex];
            const descriptions: Record<string, string> = {
                'read': 'Leer cuento en voz alta',
                'save': 'Guardar en mi biblioteca',
                'pdf': 'Descargar como PDF',
                'new': 'Crear otro cuento',
                'home': 'Volver al inicio',
            };

            speakOption(descriptions[currentOption.id] || currentOption.label);
        }
    }, [scanIndex, voiceEnabled, isGeneratingPDF, isSaving]);

    // Guardar historia en biblioteca
    const handleSaveStory = useCallback(async () => {
        if (!studentId) {
            setSaveMessage('Error: No se puede guardar sin estudiante');
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase.from('stories').insert({
                student_id: studentId,
                title: title,
                content: content,
                protagonist: protagonist,
                scenery: scenery,
                mission: mission,
                style: style,
                type: 'story',
                image_url: chapters[0]?.imageUrl || null,
            });

            if (error) throw error;

            setSaveMessage('¡Cuento guardado en tu biblioteca!');
            if (voiceEnabled) speak('Cuento guardado en tu biblioteca');
            onSaveSuccess?.();
        } catch (err: any) {
            console.error('Error saving story:', err);
            setSaveMessage('Error al guardar: ' + err.message);
        } finally {
            setIsSaving(false);
            setTimeout(() => setSaveMessage(null), 3000);
        }
    }, [studentId, title, content, protagonist, scenery, mission, style, chapters, voiceEnabled, onSaveSuccess]);

    // Generar PDF usando la utilidad centralizada
    const generatePDF = async () => {
        setIsGeneratingPDF(true);
        setPdfProgress('Iniciando generación de PDF...');
        if (voiceEnabled) speak('Iniciando generación de PDF. Esto puede tomar unos momentos.');

        try {
            await generateStoryPDF({
                title,
                content,
                protagonist,
                scenery,
                mission,
                style,
                onProgress: (status) => setPdfProgress(status)
            });

            console.log('PDF saved successfully');
            setPdfProgress('¡Listo!');

            if (voiceEnabled) {
                speak('PDF descargado correctamente.');
            }
        } catch (error: any) {
            console.error('Error generando PDF:', error);
            setPdfProgress('Error al generar PDF');
            if (voiceEnabled) {
                speak('Error al generar el PDF: ' + (error.message || 'Error desconocido'));
            }
        } finally {
            setIsGeneratingPDF(false);
            setTimeout(() => setPdfProgress(''), 3000);
        }
    };

    // Manejar selección
    const handleSelect = useCallback((optionId: string) => {
        if (hasSelectedRef.current) return;
        hasSelectedRef.current = true;

        // Sonido de selección
        playSelectionSound();

        switch (optionId) {
            case 'read':
                onRead(content);
                break;
            case 'save':
                handleSaveStory();
                break;
            case 'pdf':
                generatePDF();
                break;
            case 'new':
                onCreateAnother?.();
                break;
            case 'home':
                onClose();
                break;
        }

        setTimeout(() => {
            hasSelectedRef.current = false;
        }, 1000);
    }, [content, onRead, onCreateAnother, onClose, handleSaveStory, generatePDF]);

    // Manejar teclas
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                handleSelect(actionOptions[scanIndex].id);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [scanIndex, handleSelect]);

    const excerpt = getExcerpt(content);
    const coverImage = chapters[0]?.imageUrl || getChapterImageForStory(scenery, 0);

    return (
        <div className="w-full h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-950">
            {/* Header */}
            <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-black/30 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-lg md:text-xl font-black text-white truncate max-w-[200px] md:max-w-none">{title}</h1>
                        <p className="text-xs text-gray-400">{chapters.length} capítulos</p>
                    </div>
                </div>
                {isSpeaking && (
                    <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1 rounded-full">
                        <span className="material-symbols-outlined text-green-400 animate-pulse">volume_up</span>
                        <span className="text-xs text-green-400 font-bold hidden sm:block">Leyendo...</span>
                    </div>
                )}
                {isSaving && (
                    <div className="flex items-center gap-2 bg-primary/20 px-3 py-1 rounded-full">
                        <span className="material-symbols-outlined text-primary animate-spin">progress_activity</span>
                        <span className="text-xs text-primary font-bold hidden sm:block">Guardando...</span>
                    </div>
                )}
            </div>

            {/* Save Message Toast */}
            {saveMessage && (
                <div className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-lg animate-fade-in ${saveMessage.includes('Error') ? 'bg-red-500/90' : 'bg-green-500/90'
                    } text-white font-bold flex items-center gap-2`}>
                    <span className="material-symbols-outlined">
                        {saveMessage.includes('Error') ? 'error' : 'check_circle'}
                    </span>
                    {saveMessage}
                </div>
            )}

            {/* Contenido Principal - 2 Columnas */}
            <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 overflow-hidden">

                {/* Columna Izquierda - Extracto del Cuento */}
                <div className="md:w-1/2 flex flex-col bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
                    {/* Imagen de portada */}
                    <div className="relative h-40 md:h-48 overflow-hidden">
                        <img
                            src={coverImage}
                            alt={title}
                            className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                            <span className="px-2 py-1 bg-primary/80 text-white text-xs font-bold rounded-full">
                                {protagonist} • {scenery}
                            </span>
                        </div>
                    </div>

                    {/* Extracto */}
                    <div className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar">
                        <h2 className="text-xl font-black text-primary mb-3">Vista Previa</h2>
                        <p className="text-gray-300 leading-relaxed text-sm md:text-base font-serif">
                            {excerpt}
                        </p>
                        <p className="mt-4 text-xs text-gray-500 italic">
                            Misión: {mission} • Estilo: {style}
                        </p>
                    </div>
                </div>

                {/* Columna Derecha - Opciones con Barrido */}
                <div className="md:w-1/2 flex flex-col gap-3">
                    <h2 className="text-lg font-bold text-gray-400 text-center mb-2">
                        ¿Qué deseas hacer?
                    </h2>

                    {actionOptions.map((option, idx) => {
                        const isActive = idx === scanIndex;
                        return (
                            <button
                                key={option.id}
                                onClick={() => handleSelect(option.id)}
                                disabled={isGeneratingPDF}
                                className={`
                                    flex items-center gap-4 p-4 md:p-6 rounded-2xl transition-all duration-300
                                    ${isActive
                                        ? 'bg-primary border-2 border-white shadow-[0_0_30px_rgba(19,127,236,0.5)] scale-[1.02]'
                                        : 'bg-slate-800 border border-slate-700 opacity-60 hover:opacity-80'}
                                    ${isGeneratingPDF ? 'cursor-wait' : 'cursor-pointer'}
                                `}
                            >
                                <div className={`
                                    size-12 md:size-14 rounded-full flex items-center justify-center
                                    ${isActive ? 'bg-white/20' : 'bg-slate-900'}
                                `}>
                                    <span className={`material-symbols-outlined text-2xl md:text-3xl ${isActive ? 'text-white' : 'text-primary'}`}>
                                        {option.icon}
                                    </span>
                                </div>
                                <span className={`text-lg md:text-xl font-bold ${isActive ? 'text-white' : 'text-gray-300'}`}>
                                    {option.label}
                                </span>

                                {/* Indicador de selección */}
                                {isActive && (
                                    <div className="ml-auto">
                                        <span className="material-symbols-outlined text-white animate-pulse">check_circle</span>
                                    </div>
                                )}

                                {/* Barra de progreso del barrido */}
                                {isActive && (
                                    <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 rounded-b-2xl overflow-hidden">
                                        <div
                                            className="h-full bg-white scan-progress-bar"
                                            style={{ '--scan-duration': `${scanInterval}ms` } as React.CSSProperties}
                                        />
                                    </div>
                                )}
                            </button>
                        );
                    })}

                    {/* Indicador de generación PDF con Progreso */}
                    {isGeneratingPDF && (
                        <div className="flex flex-col items-center justify-center gap-3 p-4 bg-yellow-500/20 rounded-xl border border-yellow-500/30">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined animate-spin text-yellow-400 text-3xl">auto_awesome</span>
                                <span className="text-yellow-400 font-bold text-lg">IA Creando Arte...</span>
                            </div>
                            <p className="text-yellow-200 text-sm animate-pulse text-center">{pdfProgress}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2 bg-black/30 border-t border-white/10 text-center">
                <p className="text-xs text-gray-500">
                    Presiona <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Espacio</kbd> o <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> para seleccionar
                </p>
            </div>
        </div>
    );
};

export default StoryReader;
