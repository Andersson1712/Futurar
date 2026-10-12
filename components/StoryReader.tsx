import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  clearBookDedication,
  saveBookDedication,
  setBookFavorite,
} from '../services/backendBooks';
import { formatDedication } from '../services/bookMappers';
import {
  listProfileContacts,
  type ProfileContactPayload,
} from '../services/backendContacts';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { playSelectionSound } from '../utils/audio';
import { speak, stopSpeaking, speakOption } from '../utils/speech';
import { t } from '../utils/messages';
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
    persisted?: boolean;
    bookId?: string;
    dedication?: string;
    dedicationPosition?: 'start' | 'end';
    isFavorite?: boolean;
    onDedicationChange?: (
        dedication: { text: string; position: 'start' | 'end' } | null,
    ) => void;
    onFavoriteChange?: (isFavorite: boolean) => void;
    initialScrollTop?: number;
    onScrollProgress?: (scrollTop: number) => void;
    onRead: (text: string) => void;
    voiceEnabled?: boolean;
    onCreateAnother?: () => void;
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
    { id: 'read', label: t('reader.read'), icon: 'volume_up' },
    { id: 'save', label: t('reader.save'), icon: 'bookmark' }, // TODO: Check if already saved?
    { id: 'dedication', label: t('reader.dedication'), icon: 'auto_stories' },
    { id: 'favorite', label: t('reader.favorite'), icon: 'star_border' },
    { id: 'pdf', label: t('reader.pdf'), icon: 'picture_as_pdf' },
    { id: 'new', label: t('reader.other'), icon: 'restart_alt' },
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
    persisted = false,
    bookId,
    dedication,
    dedicationPosition = 'start',
    isFavorite: initialFavorite = false,
    onDedicationChange,
    onFavoriteChange,
    initialScrollTop = 0,
    onScrollProgress,
    onRead,
    voiceEnabled = true,
    onCreateAnother,
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
    const previewRef = useRef<HTMLDivElement>(null);
    const scrollSaveTimeoutRef = useRef<number | null>(null);

    // Dedication + favorite (SPEC-022)
    const [showDedicationModal, setShowDedicationModal] = useState(false);
    const [contacts, setContacts] = useState<ProfileContactPayload[]>([]);
    const [dedicationName, setDedicationName] = useState('');
    const [dedicationReason, setDedicationReason] = useState('');
    const [dedicationAt, setDedicationAt] = useState<'start' | 'end'>(
        dedicationPosition,
    );
    const [isSavingDedication, setIsSavingDedication] = useState(false);
    const [isFavorite, setIsFavorite] = useState(initialFavorite);
    const dedicationDialogRef = useRef<HTMLDivElement>(null);

    useDialogA11y(dedicationDialogRef, showDedicationModal, () =>
        setShowDedicationModal(false),
    );

    useEffect(() => {
        setIsFavorite(initialFavorite);
    }, [initialFavorite]);

    const showToast = useCallback((message: string) => {
        setSaveMessage(message);
        setTimeout(() => setSaveMessage(null), 3000);
    }, []);

    // Restore the preview scroll position (SPEC-014)
    useEffect(() => {
        if (!initialScrollTop || !previewRef.current) return;

        const frame = requestAnimationFrame(() => {
            if (previewRef.current) {
                previewRef.current.scrollTop = initialScrollTop;
            }
        });

        return () => cancelAnimationFrame(frame);
    }, [initialScrollTop, chapters.length]);

    const handlePreviewScroll = useCallback(() => {
        const node = previewRef.current;

        if (!node || !onScrollProgress) return;

        if (scrollSaveTimeoutRef.current !== null) {
            window.clearTimeout(scrollSaveTimeoutRef.current);
        }

        scrollSaveTimeoutRef.current = window.setTimeout(() => {
            onScrollProgress(node.scrollTop);
            scrollSaveTimeoutRef.current = null;
        }, 400);
    }, [onScrollProgress]);

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
        if (isGeneratingPDF || isSaving || showDedicationModal) return;

        const timer = setInterval(() => {
            setScanIndex((prev) => (prev + 1) % actionOptions.length);
        }, scanInterval);

        return () => clearInterval(timer);
    }, [isGeneratingPDF, isSaving, showDedicationModal, scanInterval]);

    // Anunciar opción
    useEffect(() => {
        if (voiceEnabled && !isGeneratingPDF && !isSaving && !showDedicationModal) {
            const currentOption = actionOptions[scanIndex];
            const descriptions: Record<string, string> = {
                'read': 'Leer cuento en voz alta',
                'save': 'Guardar en mi biblioteca',
                'dedication': t('reader.dedicationTitle'),
                'favorite': isFavorite
                    ? t('reader.favoriteRemove')
                    : t('reader.favoriteAdd'),
                'pdf': 'Descargar como PDF',
                'new': 'Crear otro cuento',
                'home': t('reader.home'),
            };

            speakOption(descriptions[currentOption.id] || currentOption.label);
        }
    }, [scanIndex, voiceEnabled, isGeneratingPDF, isSaving, showDedicationModal, isFavorite]);

    // Guardar historia en biblioteca
    const handleSaveStory = useCallback(() => {
        // Books generated through the backend are already persisted (SPEC-008).
        if (persisted) {
            setSaveMessage('Tu cuento ya está en tu biblioteca');
            if (voiceEnabled) speak('Tu cuento ya está en tu biblioteca');
            setTimeout(() => setSaveMessage(null), 3000);
            return;
        }

        // SPEC-032: no legacy fallback. An unpersisted story has no data
        // layer to save to — report loudly instead of a silent success.
        setSaveMessage('Error: este cuento no está guardado en tu biblioteca');
        if (voiceEnabled) speak('Error: este cuento no está guardado en tu biblioteca');
        setTimeout(() => setSaveMessage(null), 3000);
    }, [persisted, voiceEnabled]);

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

    // Dedicatoria (SPEC-022)
    const openDedication = useCallback(async () => {
        setDedicationAt(dedicationPosition);
        setShowDedicationModal(true);

        if (!studentId || !bookId) return;

        try {
            setContacts(await listProfileContacts(studentId));
        } catch (error) {
            console.error('Error loading contacts:', error);
        }
    }, [studentId, bookId, dedicationPosition]);

    const handleSaveDedication = async () => {
        if (!bookId || !dedicationName.trim()) return;

        setIsSavingDedication(true);
        try {
            const updated = await saveBookDedication(bookId, {
                to: dedicationName.trim(),
                reason: dedicationReason.trim() || undefined,
                position: dedicationAt,
            });

            onDedicationChange?.({
                text: formatDedication(updated) ?? '',
                position: updated.dedicationPosition ?? 'start',
            });
            setShowDedicationModal(false);
            showToast(t('reader.dedicationSaved'));
            if (voiceEnabled) speak(t('reader.dedicationSaved'));
        } catch (error) {
            console.error('Error saving dedication:', error);
            showToast(t('reader.dedicationError'));
        } finally {
            setIsSavingDedication(false);
        }
    };

    const handleClearDedication = async () => {
        if (!bookId) return;

        setIsSavingDedication(true);
        try {
            await clearBookDedication(bookId);
            onDedicationChange?.(null);
            setShowDedicationModal(false);
            showToast(t('reader.dedicationRemoved'));
        } catch (error) {
            console.error('Error clearing dedication:', error);
            showToast(t('reader.dedicationError'));
        } finally {
            setIsSavingDedication(false);
        }
    };

    const handleToggleFavorite = async () => {
        if (!bookId) {
            showToast(t('reader.favoriteError'));
            return;
        }

        try {
            const updated = await setBookFavorite(bookId, !isFavorite);
            const next = updated.isFavorite ?? !isFavorite;

            setIsFavorite(next);
            onFavoriteChange?.(next);
            showToast(t('reader.favoriteSaved'));
        } catch (error) {
            console.error('Error updating favorite:', error);
            showToast(t('reader.favoriteError'));
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
            case 'dedication':
                void openDedication();
                break;
            case 'favorite':
                void handleToggleFavorite();
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
    }, [content, onRead, onCreateAnother, onClose, handleSaveStory, generatePDF, openDedication, handleToggleFavorite]);

    // Manejar teclas
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (showDedicationModal) return;

            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                handleSelect(actionOptions[scanIndex].id);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [scanIndex, handleSelect, showDedicationModal]);

    const excerpt = getExcerpt(content);
    const coverImage = chapters[0]?.imageUrl || getChapterImageForStory(scenery, 0);

    return (
        <div className="w-full min-h-[100dvh] flex flex-col bg-gradient-to-b from-slate-900 to-slate-950">
            {/* Header */}
            <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-black/30 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 min-w-11 min-h-11 hover:bg-white/10 rounded-full transition-colors"
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
                    <div
                        ref={previewRef}
                        onScroll={handlePreviewScroll}
                        className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar"
                    >
                        <h2 className="text-xl font-black text-primary mb-3">Vista Previa</h2>
                        {dedication && dedicationPosition === 'start' && (
                            <p className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-100 italic">
                                {dedication}
                            </p>
                        )}
                        <p className="text-gray-300 leading-relaxed text-sm md:text-base font-serif">
                            {excerpt}
                        </p>
                        {dedication && dedicationPosition === 'end' && (
                            <p className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-100 italic">
                                {dedication}
                            </p>
                        )}
                        <p className="mt-4 text-xs text-gray-400 italic">
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
                        const isFavoriteOption = option.id === 'favorite';
                        const label = isFavoriteOption
                            ? (isFavorite ? t('reader.favoriteRemove') : t('reader.favoriteAdd'))
                            : option.label;
                        const icon = isFavoriteOption
                            ? (isFavorite ? 'star' : 'star_border')
                            : option.icon;

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
                                        {icon}
                                    </span>
                                </div>
                                <span className={`text-lg md:text-xl font-bold ${isActive ? 'text-white' : 'text-gray-300'}`}>
                                    {label}
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

            {/* Dedication Modal (SPEC-022) */}
            {showDedicationModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
                    role="presentation"
                >
                    <div
                        ref={dedicationDialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="dedication-title"
                        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-slate-800 border border-slate-600 rounded-2xl p-6 text-white"
                    >
                        <h2
                            id="dedication-title"
                            className="text-2xl font-black mb-2"
                        >
                            {t('reader.dedicationTitle')}
                        </h2>
                        <p className="text-gray-400 text-sm mb-4">
                            {t('reader.dedicationHint')}
                        </p>
                        <p className="text-gray-500 text-xs mb-4">
                            {t('reader.dedicationPrivacy')}
                        </p>

                        {contacts.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {contacts.map((contact) => (
                                    <button
                                        key={contact.id}
                                        type="button"
                                        onClick={() => {
                                            setDedicationName(contact.name);
                                            setDedicationReason(
                                                contact.dedicationReason ?? '',
                                            );
                                        }}
                                        className={`min-h-11 px-4 py-2 rounded-xl border-2 text-sm font-bold transition-all ${
                                            dedicationName === contact.name
                                                ? 'border-primary bg-primary/20'
                                                : 'border-white/10 hover:border-white/30 text-gray-300'
                                        }`}
                                    >
                                        {contact.name} · {contact.relationship}
                                    </button>
                                ))}
                            </div>
                        )}

                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {t('reader.dedicationName')}
                        </label>
                        <input
                            type="text"
                            value={dedicationName}
                            onChange={(event) =>
                                setDedicationName(event.target.value)
                            }
                            maxLength={80}
                            className="w-full min-h-11 bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 mb-4 focus:border-primary focus:outline-none"
                        />

                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            {t('reader.dedicationReason')}
                        </label>
                        <input
                            type="text"
                            value={dedicationReason}
                            onChange={(event) =>
                                setDedicationReason(event.target.value)
                            }
                            maxLength={200}
                            className="w-full min-h-11 bg-slate-900 border border-slate-600 rounded-xl px-4 py-3 mb-4 focus:border-primary focus:outline-none"
                        />

                        <p className="text-sm font-medium text-gray-400 mb-2">
                            {t('reader.dedicationPosition')}
                        </p>
                        <div className="flex gap-3 mb-6">
                            {([
                                { value: 'start', label: t('reader.dedicationStart') },
                                { value: 'end', label: t('reader.dedicationEnd') },
                            ] as const).map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => setDedicationAt(option.value)}
                                    className={`flex-1 min-h-11 px-4 py-3 rounded-xl border-2 font-bold transition-all ${
                                        dedicationAt === option.value
                                            ? 'border-primary bg-primary/20'
                                            : 'border-white/10 hover:border-white/30 text-gray-400'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                type="button"
                                onClick={() => void handleSaveDedication()}
                                disabled={!dedicationName.trim() || isSavingDedication}
                                className="min-h-12 px-4 py-3 rounded-xl bg-primary hover:bg-primary/80 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {t('reader.dedicationSave')}
                            </button>
                            {bookId && dedication && (
                                <button
                                    type="button"
                                    onClick={() => void handleClearDedication()}
                                    disabled={isSavingDedication}
                                    className="min-h-12 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold disabled:opacity-50"
                                >
                                    {t('reader.dedicationClear')}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowDedicationModal(false)}
                                className="min-h-12 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 font-bold"
                            >
                                {t('reader.dedicationClose')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2 bg-black/30 border-t border-white/10 text-center">
                <p className="text-xs text-gray-400">
                    Presiona <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Espacio</kbd> o <kbd className="px-1.5 py-0.5 bg-slate-800 rounded">Enter</kbd> para seleccionar
                </p>
            </div>
        </div>
    );
};

export default StoryReader;
