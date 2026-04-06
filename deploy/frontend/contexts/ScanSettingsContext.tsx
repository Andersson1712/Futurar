/**
 * ScanSettingsContext - Global context for scanning/barrido controls
 * Manages scan speed, voice feedback, and pause state across the app
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { announceBreak, announceResume, stopSpeaking } from '../utils/speech';

export interface ScanSettings {
    scanInterval: number;
    voiceEnabled: boolean;
    isPaused: boolean;
    soundEnabled: boolean;
}

interface ScanSettingsContextType extends ScanSettings {
    setScanInterval: (interval: number) => void;
    toggleVoice: () => void;
    togglePause: () => void;
    setVoiceEnabled: (enabled: boolean) => void;
    setSoundEnabled: (enabled: boolean) => void;
    goToMenu: () => void;
    setGoToMenuHandler: (handler: () => void) => void;
}

const defaultSettings: ScanSettings = {
    scanInterval: 3000,
    voiceEnabled: true,
    isPaused: false,
    soundEnabled: true,
};

const ScanSettingsContext = createContext<ScanSettingsContextType | null>(null);

interface ScanSettingsProviderProps {
    children: ReactNode;
    initialSettings?: Partial<ScanSettings>;
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
    const [goToMenuHandler, setGoToMenuHandlerState] = useState<(() => void) | null>(
        () => onGoToMenu || null
    );

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

export default ScanSettingsContext;
