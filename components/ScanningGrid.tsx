import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScanOption } from '../types';
import { useInputDevice } from '../hooks/useInputDevice';
import { playSelectionSound } from '../utils/audio';
import { speakOption, stopSpeaking } from '../utils/speech';

interface ScanningGridProps {
  options: ScanOption[];
  onSelect: (option: ScanOption) => void;
  scanInterval?: number;
  columns?: number;
  soundEnabled?: boolean;
  voiceEnabled?: boolean;
  compact?: boolean;
  isPaused?: boolean;
}

const ScanningGrid: React.FC<ScanningGridProps> = ({
  options,
  onSelect,
  scanInterval = 3000,
  columns = 2,
  soundEnabled = true,
  voiceEnabled = true,
  compact = false,
  isPaused = false
}) => {
  const [index, setIndex] = useState(0);
  const hasSelectedRef = useRef(false);

  // Resetear índice cuando cambian las opciones
  useEffect(() => {
    setIndex(0);
    hasSelectedRef.current = false;
  }, [options]);

  // Avanzar al siguiente elemento automáticamente (respeta pausa)
  useEffect(() => {
    if (isPaused) return; // No iniciar timer si está pausado

    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % options.length);
    }, scanInterval);
    return () => clearInterval(timer);
  }, [options.length, scanInterval, isPaused]);

  // Leer en voz alta la opción actual durante el barrido (respeta pausa)
  useEffect(() => {
    if (voiceEnabled && options[index] && !isPaused) {
      speakOption(options[index].label);
    }
  }, [index, voiceEnabled, options, isPaused]);

  // Manejar activación (selección del elemento actual)
  const handleActivate = useCallback(() => {
    if (hasSelectedRef.current) return;
    hasSelectedRef.current = true;

    // Parar la voz
    stopSpeaking();

    if (soundEnabled) {
      playSelectionSound();
    }

    onSelect(options[index]);

    setTimeout(() => {
      hasSelectedRef.current = false;
    }, 500);
  }, [index, onSelect, options, soundEnabled]);

  // Usar hook de entrada
  const { connectedDevice, isHIDSupported } = useInputDevice({
    onActivate: handleActivate,
    enabled: true
  });

  // Determinar clases de grid responsivas
  const getGridClasses = () => {
    if (compact) {
      switch (columns) {
        case 1: return 'grid-cols-1';
        case 2: return 'grid-cols-2';
        case 3: return 'grid-cols-3';
        default: return 'grid-cols-4';
      }
    }

    switch (columns) {
      case 1: return 'grid-cols-1 max-w-md mx-auto';
      case 2: return 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto';
      case 3: return 'grid-cols-2 md:grid-cols-3 max-w-4xl mx-auto';
      default: return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-5xl mx-auto';
    }
  };

  return (
    <div className="relative w-full">
      {/* Indicador de dispositivo conectado */}
      {connectedDevice && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm z-10">
          <span className="material-symbols-outlined text-base">usb</span>
          <span className="font-medium">{connectedDevice.productName}</span>
        </div>
      )}

      {/* Grid de opciones */}
      <div className={`grid gap-3 md:gap-4 lg:gap-6 w-full ${getGridClasses()}`}>
        {options.map((opt, i) => {
          const isActive = i === index;
          return (
            <div
              key={opt.id}
              className={`
                relative flex flex-col items-center justify-center 
                ${compact ? 'p-3 md:p-4 rounded-xl' : 'p-4 md:p-6 lg:p-8 rounded-2xl md:rounded-3xl'}
                transition-all duration-300 cursor-pointer
                ${isActive
                  ? 'bg-primary border-2 md:border-4 border-white shadow-[0_0_30px_rgba(19,127,236,0.5)] scale-[1.02] md:scale-105 z-20'
                  : 'bg-slate-800 border border-slate-700 opacity-70 hover:opacity-90 hover:scale-[1.01]'}
              `}
              data-no-scan="true"
              onClick={(e) => {
                e.stopPropagation();
                stopSpeaking();
                onSelect(opt);
              }}
            >
              {/* Indicador de selección activa */}
              {isActive && (
                <div className={`absolute ${compact ? 'top-2 right-2' : 'top-3 right-3 md:top-4 md:right-4'} bg-white text-primary rounded-full p-0.5 md:p-1 animate-pulse`}>
                  <span className={`material-symbols-outlined ${compact ? 'text-base' : 'text-lg md:text-2xl'}`}>check</span>
                </div>
              )}

              {/* Imagen o icono */}
              {opt.image ? (
                <div className={`w-full ${compact ? 'aspect-square' : 'aspect-video'} rounded-lg md:rounded-xl overflow-hidden mb-2 md:mb-4`}>
                  <img src={opt.image} alt={opt.label} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`
                  ${compact ? 'size-12 md:size-16' : 'size-16 md:size-20 lg:size-24'} 
                  rounded-full flex items-center justify-center mb-2 md:mb-4 transition-colors
                  ${isActive ? 'bg-white/20' : 'bg-slate-900'}
                `}>
                  <span className={`material-symbols-outlined ${compact ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl lg:text-5xl'} ${isActive ? 'text-white' : 'text-primary'}`}>
                    {opt.icon}
                  </span>
                </div>
              )}

              {/* Etiqueta */}
              <h3 className={`
                ${compact ? 'text-sm md:text-base' : 'text-lg md:text-xl lg:text-2xl'} 
                font-black text-center leading-tight
                ${isActive ? 'text-white' : 'text-gray-300'}
              `}>
                {opt.label}
              </h3>

              {/* Descripción opcional */}
              {!compact && opt.description && (
                <p className={`mt-1 md:mt-2 text-xs md:text-sm font-medium text-center ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                  {opt.description}
                </p>
              )}

              {/* Barra de progreso del escaneo */}
              {isActive && (
                <div className={`absolute bottom-0 left-0 w-full h-1 bg-white/20 ${compact ? 'rounded-b-xl' : 'rounded-b-2xl md:rounded-b-3xl'} overflow-hidden`}>
                  <div
                    className="h-full bg-white scan-progress-bar"
                    style={{ '--scan-duration': `${scanInterval}ms` } as React.CSSProperties}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Indicador de soporte HID */}
      {!compact && isHIDSupported && !connectedDevice && (
        <p className="text-center text-gray-500 text-xs md:text-sm mt-4 md:mt-6">
          Presiona <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Espacio</kbd> o <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs">Enter</kbd> para seleccionar
        </p>
      )}
    </div>
  );
};

export default ScanningGrid;
