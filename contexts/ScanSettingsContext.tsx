/**
 * ScanSettingsContext - Global context for scanning/barrido controls
 * Manages scan speed, voice feedback, and pause state across the app
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { announceBreak, announceResume, stopSpeaking } from '../utils/speech';
import type { InputMode } from '../utils/accessibility';

export interface ScanSettings {
    scanInterval: number;
    voiceEnabled: boolean;
    isPaused: boolean;
    soundEnabled: boolean;
    sweepEnabled: boolean;
    inputMode: InputMode;
}

export interface ProfileScanSettings {
    scanInterval?: number;
    scanColumns?: number;
    voiceEnabled?: boolean;
    soundEnabled?: boolean;
    sweepEnabled?: boolean;
    inputMode?: InputMode;
}

interface ScanSettingsContextType extends ScanSettings {
    scanColumns: number;
    setScanInterval: (interval: number) => void;
    toggleVoice: () => void;
    togglePause: () => void;
    setVoiceEnabled: (enabled: boolean) => void;
    setSoundEnabled: (enabled: boolean) => void;
    goToMenu: () => void;
    setGoToMenuHandler: (handler: () => void) => void;
    isModalOpen: boolean;
    setModalOpen: (open: boolean) => void;
    applyProfileSettings: (settings: ProfileScanSettings) => void;
}

const defaultSettings: ScanSettings & { scanColumns: number } = {
    scanInterval: 3000,
    voiceEnabled: true,
    isPaused: false,
    soundEnabled: true,
    sweepEnabled: true,
    inputMode: 'scan',
    scanColumns: 2,
};

const ScanSettingsContext = createContext<ScanSettingsContextType | null>(null);

interface ScanSettingsProviderProps {
    children: ReactNode;
    initialSettings?: Partial<ScanSettings & { scanColumns: number }>;
    onGoToMenu?: () => void;
}

export const ScanSettingsProvider: React.FC<ScanSettingsProviderProps> = ({
    children,
    initialSettings,
    onGoToMenu,
}) => {
    const [scanInterval, setScanIntervalState] = useState(
        initialSettings?.scanInterval ?? defaultSettings.scanInterval
    );
    const [voiceEnabled, setVoiceEnabledState] = useState(
        initialSettings?.voiceEnabled ?? defaultSettings.voiceEnabled
    );
    const [isPaused, setIsPaused] = useState(
        initialSettings?.isPaused ?? defaultSettings.isPaused
    );
    const [soundEnabled, setSoundEnabledState] = useState(
        initialSettings?.soundEnabled ?? defaultSettings.soundEnabled
    );
    const [sweepEnabled, setSweepEnabled] = useState(
        initialSettings?.sweepEnabled ?? defaultSettings.sweepEnabled
    );
    const [inputMode, setInputMode] = useState<InputMode>(
        initialSettings?.inputMode ?? defaultSettings.inputMode
    );
    const [scanColumns, setScanColumnsState] = useState(
        initialSettings?.scanColumns ?? defaultSettings.scanColumns
    );
    const [goToMenuHandler, setGoToMenuHandlerState] = useState<(() => void) | null>(
        () => onGoToMenu || null
    );
    const [isModalOpen, setIsModalOpen] = useState(false);

    const setModalOpen = useCallback((open: boolean) => {
        setIsModalOpen(open);
    }, []);

    // Update settings when initial settings change
    useEffect(() => {
        if (initialSettings?.scanInterval !== undefined) {
            setScanIntervalState(initialSettings.scanInterval);
        }
        if (initialSettings?.voiceEnabled !== undefined) {
            setVoiceEnabledState(initialSettings.voiceEnabled);
        }
        if (initialSettings?.soundEnabled !== undefined) {
            setSoundEnabledState(initialSettings.soundEnabled);
        }
    }, [initialSettings?.scanInterval, initialSettings?.voiceEnabled, initialSettings?.soundEnabled]);

    const setScanInterval = useCallback((interval: number) => {
        setScanIntervalState(interval);
    }, []);

    // Seed the session with the active profile settings (SPEC-015)
    const applyProfileSettings = useCallback((settings: ProfileScanSettings) => {
        if (settings.scanInterval !== undefined) {
            setScanIntervalState(settings.scanInterval);
        }
        if (settings.scanColumns !== undefined) {
            setScanColumnsState(settings.scanColumns);
        }
        if (settings.voiceEnabled !== undefined) {
            setVoiceEnabledState(settings.voiceEnabled);
        }
        if (settings.soundEnabled !== undefined) {
            setSoundEnabledState(settings.soundEnabled);
        }
        if (settings.sweepEnabled !== undefined) {
            setSweepEnabled(settings.sweepEnabled);
        }
        if (settings.inputMode !== undefined) {
            setInputMode(settings.inputMode);
        }
    }, []);

    const setVoiceEnabled = useCallback((enabled: boolean) => {
        setVoiceEnabledState(enabled);
        if (!enabled) {
            stopSpeaking();
        }
    }, []);

    const setSoundEnabled = useCallback((enabled: boolean) => {
        setSoundEnabledState(enabled);
    }, []);

    const toggleVoice = useCallback(() => {
        setVoiceEnabledState(prev => {
            const newValue = !prev;
            if (!newValue) {
                stopSpeaking();
            }
            return newValue;
        });
    }, []);

    const togglePause = useCallback(() => {
        setIsPaused(prev => {
            const newValue = !prev;
            if (newValue) {
                // Entering pause mode
                stopSpeaking();
                if (voiceEnabled) {
                    announceBreak();
                }
            } else {
                // Resuming
                if (voiceEnabled) {
                    announceResume();
                }
            }
            return newValue;
        });
    }, [voiceEnabled]);

    const goToMenu = useCallback(() => {
        if (goToMenuHandler) {
            stopSpeaking();
            setIsPaused(false);
            goToMenuHandler();
        }
    }, [goToMenuHandler]);

    const setGoToMenuHandler = useCallback((handler: () => void) => {
        setGoToMenuHandlerState(() => handler);
    }, []);

    return (
        <ScanSettingsContext.Provider
            value={{
                scanInterval,
                voiceEnabled,
                isPaused,
                soundEnabled,
                setScanInterval,
                toggleVoice,
                togglePause,
                setVoiceEnabled,
                setSoundEnabled,
                goToMenu,
                setGoToMenuHandler,
                isModalOpen,
                setModalOpen,
                scanColumns,
                sweepEnabled,
                inputMode,
                applyProfileSettings,
            }}
        >
            {children}
        </ScanSettingsContext.Provider>
    );
};

export const useScanSettings = (): ScanSettingsContextType => {
    const context = useContext(ScanSettingsContext);
    if (!context) {
        throw new Error('useScanSettings must be used within a ScanSettingsProvider');
    }
    return context;
};

/** Optional variant for components that must work without a provider. */
export const useScanSettingsOptional = (): ScanSettingsContextType | null => {
    return useContext(ScanSettingsContext);
};

export default ScanSettingsContext;
