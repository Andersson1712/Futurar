/**
 * FloatingControls - Floating action button with accessibility controls
 * Provides quick access to scan speed, voice toggle, break mode, and menu navigation
 * SPEC-013: trapped dialog with switch/keyboard navigation.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useScanSettings } from '../contexts/ScanSettingsContext';
import { speak, speakOption, stopSpeaking } from '../utils/speech';
import { playSelectionSound } from '../utils/audio';

interface FloatingControlsProps {
    onGoToMenu?: () => void;
}

const speedOptions = [
    { value: 2000, label: 'Rápido', description: '2 segundos' },
    { value: 3000, label: 'Normal', description: '3 segundos' },
    { value: 4000, label: 'Lento', description: '4 segundos' },
    { value: 5000, label: 'Muy lento', description: '5 segundos' },
];

const FloatingControls: React.FC<FloatingControlsProps> = ({ onGoToMenu }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [index, setIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const toggleButtonRef = useRef<HTMLButtonElement>(null);
    const wasOpenRef = useRef(false);

    const {
        scanInterval,
        voiceEnabled,
        isPaused,
        soundEnabled,
        setScanInterval,
        toggleVoice,
        togglePause,
        setModalOpen,
    } = useScanSettings();

    const getOptions = useCallback((): HTMLButtonElement[] => {
        if (!dialogRef.current) return [];

        return Array.from(
            dialogRef.current.querySelectorAll<HTMLButtonElement>(
                'button:not([disabled])'
            )
        );
    }, []);

    const closeMenu = useCallback(() => {
        setIsOpen(false);
        setShowSpeedMenu(false);
    }, []);

    // Block the rest of the UI and pause scanning while the dialog is open
    useEffect(() => {
        setModalOpen(isOpen);

        return () => setModalOpen(false);
    }, [isOpen, setModalOpen]);

    // Move focus into the dialog when it opens and restore it when it closes
    useEffect(() => {
        if (isOpen) {
            wasOpenRef.current = true;
            setIndex(0);
            getOptions()[0]?.focus();
            return;
        }

        if (wasOpenRef.current) {
            wasOpenRef.current = false;
            toggleButtonRef.current?.focus();
        }
    }, [isOpen, getOptions]);

    // Keep the index inside the current option list (speed submenu changes)
    useEffect(() => {
        const total = getOptions().length;

        if (total > 0) {
            setIndex((previous) => (previous < total ? previous : 0));
        }
    }, [showSpeedMenu, getOptions]);

    // Switch scanning inside the dialog
    useEffect(() => {
        if (!isOpen) return;

        const timer = setInterval(() => {
            const total = getOptions().length;
            if (total === 0) return;

            setIndex((previous) => (previous + 1) % total);
        }, scanInterval);

        return () => clearInterval(timer);
    }, [isOpen, scanInterval, getOptions]);

    // Highlight and announce the focused option
    useEffect(() => {
        if (!isOpen) return;

        const options = getOptions();

        options.forEach((option, position) => {
            const isActive = position === index;

            if (isActive) {
                option.setAttribute('data-active', 'true');

                if (voiceEnabled) {
                    speakOption(option.textContent?.trim() ?? '');
                }
            } else {
                option.removeAttribute('data-active');
            }
        });
    }, [isOpen, index, showSpeedMenu, voiceEnabled, getOptions]);

    // Keyboard navigation + trap: capture phase so grids behind never react
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const options = getOptions();
            if (options.length === 0) return;

            const total = options.length;
            const stop = () => {
                event.preventDefault();
                event.stopImmediatePropagation();
            };

            if (event.key === ' ' || event.key === 'Enter') {
                stop();
                options[index % total]?.click();
                return;
            }

            if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
                stop();
                setIndex((previous) => (previous + 1) % total);
                return;
            }

            if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
                stop();
                setIndex((previous) => (previous - 1 + total) % total);
                return;
            }

            if (event.key === 'Tab') {
                stop();
                setIndex((previous) =>
                    event.shiftKey
                        ? (previous - 1 + total) % total
                        : (previous + 1) % total
                );
                return;
            }

            if (event.key === 'Escape') {
                stop();
                closeMenu();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);

        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen, index, getOptions, closeMenu]);

    const handleToggle = useCallback(() => {
        if (soundEnabled) playSelectionSound();
        setIsOpen(prev => !prev);
        setShowSpeedMenu(false);
        if (!isOpen && voiceEnabled) {
            speak('Controles de accesibilidad');
        }
    }, [isOpen, voiceEnabled, soundEnabled]);

    const handleSpeedClick = useCallback(() => {
        if (soundEnabled) playSelectionSound();
        setShowSpeedMenu(prev => !prev);
        if (voiceEnabled) {
            speak('Velocidad de barrido');
        }
    }, [voiceEnabled, soundEnabled]);

    const handleSpeedSelect = useCallback((value: number, label: string) => {
        if (soundEnabled) playSelectionSound();
        setScanInterval(value);
        setShowSpeedMenu(false);
        if (voiceEnabled) {
            speak(`Velocidad: ${label}`);
        }
    }, [setScanInterval, voiceEnabled, soundEnabled]);

    const handleVoiceToggle = useCallback(() => {
        if (soundEnabled) playSelectionSound();
        const newState = !voiceEnabled;
        toggleVoice();
        // Announce after toggle if enabling
        if (newState) {
            setTimeout(() => speak('Voz activada'), 100);
        }
    }, [toggleVoice, voiceEnabled, soundEnabled]);

    const handlePauseToggle = useCallback(() => {
        if (soundEnabled) playSelectionSound();
        togglePause();
        closeMenu();
    }, [togglePause, soundEnabled, closeMenu]);

    // Use onGoToMenu prop directly instead of context goToMenu to avoid render loop
    const handleMenuClick = useCallback(() => {
        if (soundEnabled) playSelectionSound();
        stopSpeaking();
        if (voiceEnabled) {
            speak('Regresando al menú principal');
        }
        closeMenu();
        setTimeout(() => {
            if (onGoToMenu) {
                onGoToMenu();
            }
        }, 300);
    }, [onGoToMenu, voiceEnabled, soundEnabled, closeMenu]);

    const currentSpeedLabel = speedOptions.find(o => o.value === scanInterval)?.label || 'Normal';

    return (
        <div
            ref={menuRef}
            className="fixed bottom-6 right-6 z-50 print:hidden"
            data-no-scan="true"
        >
            {/* Modal backdrop: blocks the UI behind without closing the dialog */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40"
                    aria-hidden="true"
                    onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                />
            )}

            {/* Main floating button */}
            <button
                ref={toggleButtonRef}
                onClick={handleToggle}
                className={`
          size-14 md:size-16 rounded-full shadow-2xl flex items-center justify-center
          transition-all duration-300 transform hover:scale-110
          ${isPaused
                        ? 'bg-amber-500 animate-pulse'
                        : isOpen
                            ? 'bg-primary rotate-45'
                            : 'bg-primary hover:bg-primary/90'
                    }
        `}
                aria-label="Controles de accesibilidad"
                aria-expanded={isOpen}
            >
                <span className="material-symbols-outlined text-2xl md:text-3xl text-white">
                    {isPaused ? 'pause_circle' : 'settings'}
                </span>
            </button>

            {/* Pause indicator badge */}
            {isPaused && !isOpen && (
                <div className="absolute -top-2 -left-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce">
                    PAUSA
                </div>
            )}

            {/* Popup menu */}
            {isOpen && (
                <div
                    ref={dialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Controles"
                    className={`
            absolute bottom-20 right-0 z-50 w-64 md:w-72
            bg-slate-900/95 backdrop-blur-xl rounded-2xl
            border border-white/10 shadow-2xl
            transform transition-all duration-300 origin-bottom-right
            scale-100 opacity-100
          `}
                >
                    {/* Header */}
                    <div className="px-4 py-3 border-b border-white/10">
                        <h3 className="text-white font-bold text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-lg text-primary">accessibility_new</span>
                            Controles
                        </h3>
                    </div>

                    {/* Menu items */}
                    <div className="p-2">
                        {/* Speed control */}
                        <div className="relative">
                            <button
                                onClick={handleSpeedClick}
                                className={`menu-option w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${showSpeedMenu ? 'bg-white/10' : 'hover:bg-white/5'}`}
                            >
                                <div className="size-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-blue-400">speed</span>
                                </div>
                                <div className="flex-1 text-left">
                                    <p className="text-white text-sm font-medium">Velocidad</p>
                                    <p className="text-gray-400 text-xs">{currentSpeedLabel}</p>
                                </div>
                                <span className={`material-symbols-outlined text-gray-400 transition-transform ${showSpeedMenu ? 'rotate-180' : ''}`}>
                                    expand_more
                                </span>
                            </button>

                            {/* Speed submenu */}
                            {showSpeedMenu && (
                                <div className="mt-1 ml-4 space-y-1 pb-2">
                                    {speedOptions.map(option => (
                                        <button
                                            key={option.value}
                                            onClick={() => handleSpeedSelect(option.value, option.label)}
                                            className={`menu-option w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${scanInterval === option.value
                                                ? 'bg-primary/20 text-primary'
                                                : 'hover:bg-white/5 text-gray-300'
                                                }`}
                                        >
                                            <span className={`material-symbols-outlined text-sm ${scanInterval === option.value ? 'text-primary' : 'text-gray-400'}`}>
                                                {scanInterval === option.value ? 'check_circle' : 'radio_button_unchecked'}
                                            </span>
                                            <span className="text-sm">{option.label}</span>
                                            <span className="text-xs text-gray-400 ml-auto">{option.description}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Voice toggle */}
                        <button
                            onClick={handleVoiceToggle}
                            className="menu-option w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
                        >
                            <div className={`size-10 rounded-full flex items-center justify-center ${voiceEnabled ? 'bg-green-500/20' : 'bg-gray-500/20'}`}>
                                <span className={`material-symbols-outlined ${voiceEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                                    {voiceEnabled ? 'volume_up' : 'volume_off'}
                                </span>
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-white text-sm font-medium">Asistente de Voz</p>
                                <p className="text-gray-400 text-xs">{voiceEnabled ? 'Activado' : 'Desactivado'}</p>
                            </div>
                            <div className={`w-10 h-6 rounded-full transition-colors ${voiceEnabled ? 'bg-green-500' : 'bg-gray-600'}`}>
                                <div className={`size-5 rounded-full bg-white shadow transform transition-transform ${voiceEnabled ? 'translate-x-4.5' : 'translate-x-0.5'} translate-y-0.5`} />
                            </div>
                        </button>

                        {/* Break/Pause button */}
                        <button
                            onClick={handlePauseToggle}
                            className={`menu-option w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${isPaused ? 'bg-amber-500/20 hover:bg-amber-500/30' : 'hover:bg-white/5'}`}
                        >
                            <div className={`size-10 rounded-full flex items-center justify-center ${isPaused ? 'bg-amber-500/30' : 'bg-purple-500/20'}`}>
                                <span className={`material-symbols-outlined ${isPaused ? 'text-amber-400' : 'text-purple-400'}`}>
                                    {isPaused ? 'play_arrow' : 'pause'}
                                </span>
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-white text-sm font-medium">
                                    {isPaused ? 'Continuar' : 'Tomar un Descanso'}
                                </p>
                                <p className="text-gray-400 text-xs">
                                    {isPaused ? 'Reanudar el barrido' : 'Pausar todo'}
                                </p>
                            </div>
                        </button>

                        {/* Divider */}
                        <div className="my-2 border-t border-white/10" />

                        {/* Go to menu */}
                        <button
                            onClick={handleMenuClick}
                            className="menu-option w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 transition-colors group"
                        >
                            <div className="size-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-red-400">home</span>
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-white text-sm font-medium group-hover:text-red-400 transition-colors">Menú Principal</p>
                                <p className="text-gray-400 text-xs">Regresar al inicio</p>
                            </div>
                        </button>

                        {/* Explicit close: outside presses never dismiss the menu */}
                        <button
                            onClick={closeMenu}
                            className="menu-option w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
                        >
                            <div className="size-10 rounded-full bg-slate-500/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-slate-300">close</span>
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-white text-sm font-medium">Cerrar</p>
                                <p className="text-gray-400 text-xs">Seguir en esta pantalla</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FloatingControls;
