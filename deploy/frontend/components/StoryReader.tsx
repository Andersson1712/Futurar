import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { playSelectionSound } from '../utils/audio';
import { speak, stopSpeaking, speakOption } from '../utils/speech';
import { getChapterImage } from '../utils/images';

type StoryReaderProps = {
    title: string;
    content: string;
    pages?: any[]; // Generated pages with images
    protagonist: string;
    scenery: string;
    style: string;
    onClose: () => void;      // Volver a StoryDetails
    onExit: () => void;       // Volver a selección de perfiles
    onGoMenu: () => void;     // Volver al menú principal
    scanInterval?: number;
    voiceEnabled?: boolean;
    soundEnabled?: boolean;
};

interface Chapter {
    title: string;
    content: string;
    imageUrl: string;
}

interface OverlayOption {
    id: string;
    label: string;
    icon: string;
}

/** Split text into word tokens preserving whitespace/newlines as separate tokens */
const tokenize = (text: string): { text: string; isWord: boolean; charStart: number }[] => {
    const tokens: { text: string; isWord: boolean; charStart: number }[] = [];
    // Match sequences of non-whitespace (words) or whitespace
    const regex = /(\S+|\s+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        const t = match[1];
        const isWord = t.trim().length > 0;
        tokens.push({ text: t, isWord, charStart: match.index });
    }
    return tokens;
};

const parseChapters = (content: string, scenery: string): Chapter[] => {
    const sections = content.split(/CAPÍTULO \d+[:]?\s?/i).filter(s => s.trim().length > 20);
    const titles = content.match(/CAPÍTULO \d+[:]?\s?[^\n]*/gi) || [];

    if (sections.length > 0) {
        return sections.map((section, idx) => ({
            title: titles[idx] || `Capítulo ${idx + 1}`,
            content: section.trim(),
            imageUrl: getChapterImage(scenery, idx + 1)
        }));
    }

    // Fallback: split by paragraphs
    const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
    return paragraphs.map((p, idx) => ({
        title: `Parte ${idx + 1}`,
        content: p.trim(),
        imageUrl: getChapterImage(scenery, idx)
    }));
};

const parseChaptersFromPages = (pages: any[], scenery: string): Chapter[] => {
    return pages.map((p, idx) => ({
        title: `Capítulo ${p.pageNumber}`,
        content: p.content,
        imageUrl: p.imageUrl || getChapterImage(scenery, idx)
    }));
};

const StoryReader: React.FC<StoryReaderProps> = ({
    title,
    content,
    pages,
    protagonist,
    scenery,
    style,
    onClose,
    onExit,
    onGoMenu,
    scanInterval = 3000,
    voiceEnabled = true,
    soundEnabled = true
}) => {
    const [chapters, setChapters] = useState<Chapter[]>([]);
    const [currentChapter, setCurrentChapter] = useState(0);
    const [isReading, setIsReading] = useState(false);
    const [isPausedByUser, setIsPausedByUser] = useState(false);
    const [readingFinished, setReadingFinished] = useState(false);
    const [showOverlay, setShowOverlay] = useState(false);
    const [overlayScanIndex, setOverlayScanIndex] = useState(0);

    // Word highlighting state
    const [highlightCharIndex, setHighlightCharIndex] = useState(-1);
    const [highlightCharLength, setHighlightCharLength] = useState(0);

    const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);
    const readingChapterRef = useRef(0);
    const activeWordRef = useRef<HTMLSpanElement | null>(null);

    // Overlay options - adapts based on reading state
    const getOverlayOptions = useCallback((): OverlayOption[] => {
        const firstOption: OverlayOption = readingFinished
            ? { id: 'replay', label: 'Volver a leer', icon: 'replay' }
            : {
                id: 'pause',
                label: isPausedByUser ? 'Reanudar' : 'Pausar',
                icon: isPausedByUser ? 'play_circle' : 'pause_circle'
            };

        return [
            firstOption,
            { id: 'back', label: 'Volver', icon: 'arrow_back' },
            { id: 'home', label: 'Menú', icon: 'home' },
            { id: 'exit', label: 'Salir', icon: 'logout' }
        ];
    }, [isPausedByUser, readingFinished]);

    const overlayOptions = getOverlayOptions();

    // Pre-tokenize all chapters
    const chapterTokens = useMemo(() => {
        return chapters.map(ch => tokenize(ch.content));
    }, [chapters]);

    // Parse chapters on mount
    useEffect(() => {
        if (pages && pages.length > 0) {
            // Use pre-generated pages with images
            const parsed = parseChaptersFromPages(pages, scenery);
            setChapters(parsed);
            chapterRefs.current = new Array(parsed.length).fill(null);
        } else if (content && scenery) {
            // Fallback: parse from text
            const parsed = parseChapters(content, scenery);
            setChapters(parsed);
            chapterRefs.current = new Array(parsed.length).fill(null);
        }
    }, [content, scenery, pages]);

    // Start reading once chapters are ready
    useEffect(() => {
        if (chapters.length > 0 && !isReading && !isPausedByUser && !showOverlay) {
            readChapter(readingChapterRef.current);
        }
    }, [chapters]);

    // Auto-scroll to highlighted word
    useEffect(() => {
        if (activeWordRef.current && containerRef.current) {
            const wordEl = activeWordRef.current;
            const container = containerRef.current;
            const wordRect = wordEl.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // If word is below or near the bottom of the container, scroll down
            const distanceFromBottom = containerRect.bottom - wordRect.bottom;
            const distanceFromTop = wordRect.top - containerRect.top;

            if (distanceFromBottom < 80 || distanceFromTop < 0) {
                // Scroll so the word is roughly 40% from the top
                const scrollTarget = wordEl.offsetTop - container.offsetTop - containerRect.height * 0.4;
                container.scrollTo({ top: scrollTarget, behavior: 'smooth' });
            }
        }
    }, [highlightCharIndex]);

    // Read a specific chapter
    const readChapter = useCallback((chapterIdx: number) => {
        if (chapterIdx >= chapters.length) {
            setIsReading(false);
            setHighlightCharIndex(-1);
            setReadingFinished(true);
            if (voiceEnabled) {
                speak('Fin del cuento.', {
                    onEnd: () => {
                        setShowOverlay(true);
                        setOverlayScanIndex(0);
                    }
                });
            } else {
                setShowOverlay(true);
                setOverlayScanIndex(0);
            }
            return;
        }

        setCurrentChapter(chapterIdx);
        readingChapterRef.current = chapterIdx;
        setIsReading(true);
        setHighlightCharIndex(-1);

        // Scroll to chapter header
        const chapterEl = chapterRefs.current[chapterIdx];
        if (chapterEl && containerRef.current) {
            chapterEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        if (voiceEnabled) {
            const chapterText = chapters[chapterIdx].content;
            speak(chapterText, {
                rate: 0.85,
                onStart: () => setIsReading(true),
                onBoundary: (charIndex: number, charLength: number) => {
                    setHighlightCharIndex(charIndex);
                    setHighlightCharLength(charLength);
                },
                onEnd: () => {
                    setHighlightCharIndex(-1);
                    setTimeout(() => {
                        const next = chapterIdx + 1;
                        readingChapterRef.current = next;
                        readChapter(next);
                    }, 800);
                }
            });
        }
    }, [chapters, voiceEnabled]);

    // Resume reading
    const resumeReading = useCallback(() => {
        setIsPausedByUser(false);
        setShowOverlay(false);
        readChapter(readingChapterRef.current);
    }, [readChapter]);

    // Handle switch press (Space/Enter)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();

                if (showOverlay) {
                    handleOverlaySelect(overlayOptions[overlayScanIndex].id);
                } else if (!isPausedByUser) {
                    // Interrupt reading → show overlay
                    stopSpeaking();
                    setIsReading(false);
                    setHighlightCharIndex(-1);
                    setShowOverlay(true);
                    setOverlayScanIndex(0);
                    if (soundEnabled) playSelectionSound();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showOverlay, overlayScanIndex, overlayOptions, soundEnabled, isPausedByUser]);

    // Overlay scanning timer
    useEffect(() => {
        if (!showOverlay) return;

        const timer = setInterval(() => {
            setOverlayScanIndex(prev => (prev + 1) % overlayOptions.length);
        }, scanInterval);

        return () => clearInterval(timer);
    }, [showOverlay, scanInterval, overlayOptions.length]);

    // Announce overlay option
    useEffect(() => {
        if (showOverlay && voiceEnabled) {
            speakOption(overlayOptions[overlayScanIndex].label);
        }
    }, [overlayScanIndex, showOverlay, voiceEnabled, overlayOptions]);

    // Handle overlay option selection
    const handleOverlaySelect = useCallback((optionId: string) => {
        if (soundEnabled) playSelectionSound();

        switch (optionId) {
            case 'pause':
                if (isPausedByUser) {
                    resumeReading();
                } else {
                    setIsPausedByUser(true);
                    setShowOverlay(false);
                    stopSpeaking();
                    setHighlightCharIndex(-1);
                }
                break;
            case 'replay':
                // Re-read from the beginning
                setReadingFinished(false);
                setShowOverlay(false);
                setCurrentChapter(0);
                readingChapterRef.current = 0;
                readChapter(0);
                break;
            case 'back':
                stopSpeaking();
                setIsReading(false);
                onClose();
                break;
            case 'home':
                stopSpeaking();
                setIsReading(false);
                onGoMenu();
                break;
            case 'exit':
                stopSpeaking();
                setIsReading(false);
                onExit();
                break;
        }
    }, [isPausedByUser, readingFinished, resumeReading, readChapter, onClose, onGoMenu, onExit, soundEnabled]);

    // When paused and user presses switch → show overlay again
    useEffect(() => {
        if (!isPausedByUser || showOverlay) return;

        const handlePausedKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                setShowOverlay(true);
                setOverlayScanIndex(0);
                if (soundEnabled) playSelectionSound();
            }
        };

        window.addEventListener('keydown', handlePausedKeyDown);
        return () => window.removeEventListener('keydown', handlePausedKeyDown);
    }, [isPausedByUser, showOverlay, soundEnabled]);

    /** Render chapter text with word-level highlighting */
    const renderChapterText = (chapterIdx: number) => {
        const tokens = chapterTokens[chapterIdx];
        if (!tokens) return null;
        const isCurrentChapter = chapterIdx === currentChapter && isReading;

        return tokens.map((token, i) => {
            if (!token.isWord) {
                // Preserve whitespace (including newlines)
                return <span key={i}>{token.text}</span>;
            }

            // Check if this word is the currently highlighted one
            const isHighlighted = isCurrentChapter
                && highlightCharIndex >= 0
                && token.charStart >= highlightCharIndex
                && token.charStart < highlightCharIndex + highlightCharLength + 5
                && token.charStart <= highlightCharIndex + 1;

            return (
                <span
                    key={i}
                    ref={isHighlighted ? (el) => { activeWordRef.current = el; } : undefined}
                    className={`transition-colors duration-150 rounded-sm ${isHighlighted
                        ? 'bg-primary/40 text-white font-bold px-0.5'
                        : ''
                        }`}
                >
                    {token.text}
                </span>
            );
        });
    };

    return (
        <div className="w-full h-screen flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-white">

            {/* Header */}
            <div className="flex items-center justify-between px-4 md:px-8 py-3 bg-black/40 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 bg-primary/20 text-primary flex items-center justify-center rounded-xl shrink-0">
                        <span className="material-symbols-outlined text-xl">auto_stories</span>
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-base md:text-lg font-black text-white truncate">{title}</h1>
                        <p className="text-xs text-gray-500">
                            {chapters.length > 0
                                ? `Capítulo ${currentChapter + 1} de ${chapters.length}`
                                : 'Cargando...'
                            }
                        </p>
                    </div>
                </div>

                {/* Reading indicator */}
                <div className="flex items-center gap-2 shrink-0">
                    {isReading && (
                        <div className="flex items-center gap-2 bg-green-500/20 px-3 py-1.5 rounded-full animate-pulse">
                            <span className="material-symbols-outlined text-green-400 text-lg">volume_up</span>
                            <span className="text-xs text-green-400 font-bold hidden sm:block">Leyendo...</span>
                        </div>
                    )}
                    {isPausedByUser && !showOverlay && (
                        <div className="flex items-center gap-2 bg-amber-500/20 px-3 py-1.5 rounded-full">
                            <span className="material-symbols-outlined text-amber-400 text-lg">pause_circle</span>
                            <span className="text-xs text-amber-400 font-bold hidden sm:block">En pausa</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Chapter progress bar */}
            <div className="w-full h-1 bg-slate-800 shrink-0">
                <div
                    className="h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-700"
                    style={{ width: chapters.length > 0 ? `${((currentChapter + 1) / chapters.length) * 100}%` : '0%' }}
                />
            </div>

            {/* Story content - scrollable */}
            <div
                ref={containerRef}
                className="flex-1 overflow-y-auto px-4 md:px-8 lg:px-16 py-6 md:py-10"
                style={{ scrollBehavior: 'smooth' }}
            >
                <div className="max-w-3xl mx-auto space-y-10">
                    {chapters.map((chapter, idx) => (
                        <div
                            key={idx}
                            ref={el => { chapterRefs.current[idx] = el; }}
                            className={`transition-all duration-500 ${idx === currentChapter
                                ? 'opacity-100'
                                : idx < currentChapter
                                    ? 'opacity-60'
                                    : 'opacity-30'
                                }`}
                        >
                            {/* Chapter image */}
                            <div className="relative w-full rounded-2xl overflow-hidden mb-6 shadow-lg">
                                <img
                                    src={chapter.imageUrl}
                                    alt={chapter.title}
                                    className="w-full h-auto object-contain max-h-[60vh] mx-auto bg-black/20"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />
                                <div className="absolute bottom-4 left-4 right-4">
                                    <h2 className={`text-lg md:text-2xl font-black ${idx === currentChapter
                                        ? 'text-primary'
                                        : 'text-white'
                                        }`}>
                                        {chapter.title}
                                    </h2>
                                </div>
                            </div>

                            {/* Chapter text with word highlights */}
                            <div className={`text-lg md:text-xl leading-loose whitespace-pre-line ${idx === currentChapter
                                ? 'text-gray-200'
                                : 'text-gray-500'
                                }`}>
                                {renderChapterText(idx)}
                            </div>

                            {/* Chapter divider */}
                            {idx < chapters.length - 1 && (
                                <div className="flex items-center justify-center gap-3 my-8 opacity-30">
                                    <div className="h-px flex-1 bg-white/20" />
                                    <span className="material-symbols-outlined text-sm text-white/30">auto_awesome</span>
                                    <div className="h-px flex-1 bg-white/20" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* End of story */}
                    {chapters.length > 0 && currentChapter >= chapters.length - 1 && !isReading && (
                        <div className="text-center py-10">
                            <span className="material-symbols-outlined text-5xl text-primary mb-3">auto_awesome</span>
                            <p className="text-xl font-bold text-gray-300">Fin del cuento</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom bar with hint */}
            <div className="px-4 py-2 bg-black/40 border-t border-white/10 text-center shrink-0">
                <p className="text-xs text-gray-500">
                    {isPausedByUser && !showOverlay
                        ? 'Presiona tu pulsador para ver las opciones'
                        : isReading
                            ? 'Presiona tu pulsador para pausar'
                            : ''
                    }
                </p>
            </div>

            {/* Overlay modal with scanning options */}
            {showOverlay && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-md space-y-4">
                        <h2 className="text-2xl font-black text-center text-white mb-6">
                            ¿Qué deseas hacer?
                        </h2>

                        {overlayOptions.map((option, idx) => {
                            const isActive = idx === overlayScanIndex;
                            return (
                                <button
                                    key={option.id}
                                    onClick={() => handleOverlaySelect(option.id)}
                                    className={`
                                        w-full flex items-center gap-4 p-5 rounded-2xl transition-all duration-300 relative overflow-hidden
                                        ${isActive
                                            ? 'bg-primary border-2 border-white shadow-[0_0_40px_rgba(19,127,236,0.5)] scale-[1.03]'
                                            : 'bg-slate-800/80 border border-slate-700 opacity-50'}
                                    `}
                                >
                                    <div className={`
                                        size-14 rounded-full flex items-center justify-center shrink-0
                                        ${isActive ? 'bg-white/20' : 'bg-slate-900'}
                                    `}>
                                        <span className={`material-symbols-outlined text-3xl ${isActive ? 'text-white' : 'text-primary'}`}>
                                            {option.icon}
                                        </span>
                                    </div>
                                    <span className={`text-xl font-bold ${isActive ? 'text-white' : 'text-gray-300'}`}>
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
                </div>
            )}
        </div>
    );
};

export default StoryReader;
