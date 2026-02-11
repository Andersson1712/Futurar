/**
 * FloatingControls - Floating action button with accessibility controls
 * Provides quick access to scan speed, voice toggle, break mode, and menu navigation
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useScanSettings } from '../contexts/ScanSettingsContext';
import { speak, stopSpeaking } from '../utils/speech';
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
    const menuRef = useRef<HTMLDivElement>(null);

    const {
        scanInterval,
        voiceEnabled,
        isPaused,
        soundEnabled,
        setScanInterval,
        toggleVoice,
        togglePause,
    } = useScanSettings();

    // Note: Removed setGoToMenuHandler useEffect - it was causing infinite render loops
    // Instead, we use onGoToMenu prop directly in handleMenuClick

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
                setShowSpeedMenu(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

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
        setIsOpen(false);
    }, [togglePause, soundEnabled]);

    // Use onGoToMenu prop directly instead of context goToMenu to avoid render loop
    const handleMenuClick = useCallback(() => {
        if (soundEnabled) playSelectionSound();
        stopSpeaking();
        if (voiceEnabled) {
            speak('Regresando al menú principal');
        }
        setIsOpen(false);
        setTimeout(() => {
            if (onGoToMenu) {
                onGoToMenu();
            }
        }, 300);
    }, [onGoToMenu, voiceEnabled, soundEnabled]);

    const currentSpeedLabel = speedOptions.find(o => o.value === scanInterval)?.label || 'Normal';

    return (
        <div
            ref={menuRef}
            className="fixed bottom-6 right-6 z-50 print:hidden"
            data-no-scan="true"
        >
            {/* Main floating button */}
            <button
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
                    className={`
            absolute bottom-20 right-0 w-64 md:w-72
            bg-slate-900/95 backdrop-blur-xl rounded-2xl
            border border-white/10 shadow-2xl
            transform transition-all duration-300 origin-bottom-right
            ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
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
                                className={`
                  w-full flex items-center gap-3 p-3 rounded-xl transition-colors
                  ${showSpeedMenu ? 'bg-white/10' : 'hover:bg-white/5'}
                `}
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
                                            className={`
                        w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors
                        ${scanInterval === option.value
                                                    ? 'bg-primary/20 text-primary'
                                                    : 'hover:bg-white/5 text-gray-300'
                                                }
                      `}
                                        >
                                            <span className={`material-symbols-outlined text-sm ${scanInterval === option.value ? 'text-primary' : 'text-gray-500'}`}>
                                                {scanInterval === option.value ? 'check_circle' : 'radio_button_unchecked'}
                                            </span>
                                            <span className="text-sm">{option.label}</span>
                                            <span className="text-xs text-gray-500 ml-auto">{option.description}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Voice toggle */}
                        <button
                            onClick={handleVoiceToggle}
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors"
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
                            className={`
                w-full flex items-center gap-3 p-3 rounded-xl transition-colors
                ${isPaused ? 'bg-amber-500/20 hover:bg-amber-500/30' : 'hover:bg-white/5'}
              `}
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
                            className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 transition-colors group"
                        >
                            <div className="size-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-red-400">home</span>
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-white text-sm font-medium group-hover:text-red-400 transition-colors">Menú Principal</p>
                                <p className="text-gray-400 text-xs">Regresar al inicio</p>
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FloatingControls;
