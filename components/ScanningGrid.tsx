
import React, { useState, useEffect, useCallback } from 'react';
import { ScanOption } from '../types';

interface ScanningGridProps {
  options: ScanOption[];
  onSelect: (option: ScanOption) => void;
  scanInterval?: number;
  columns?: number;
}

const ScanningGrid: React.FC<ScanningGridProps> = ({ 
  options, 
  onSelect, 
  scanInterval = 3000, 
  columns = 2 
}) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % options.length);
    }, scanInterval);
    return () => clearInterval(timer);
  }, [options.length, scanInterval]);

  const handleGlobalClick = useCallback(() => {
    onSelect(options[index]);
  }, [index, onSelect, options]);

  useEffect(() => {
    window.addEventListener('click', handleGlobalClick);
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') handleGlobalClick();
    };
    window.addEventListener('keydown', handleKeydown);
    
    return () => {
      window.removeEventListener('click', handleGlobalClick);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [handleGlobalClick]);

  return (
    <div className={`grid gap-8 w-full ${columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
      {options.map((opt, i) => {
        const isActive = i === index;
        return (
          <div
            key={opt.id}
            className={`
              relative flex flex-col items-center justify-center p-8 rounded-[2rem] transition-all duration-300
              ${isActive 
                ? 'bg-primary border-4 border-white shadow-[0_0_40px_rgba(19,127,236,0.5)] scale-105 z-10' 
                : 'bg-surface-dark border-2 border-border-accent opacity-60 scale-95'}
            `}
          >
            {isActive && (
              <div className="absolute top-4 right-4 bg-white text-primary rounded-full p-1 animate-pulse">
                <span className="material-symbols-outlined text-2xl">check</span>
              </div>
            )}
            
            {opt.image ? (
              <div className="w-full aspect-video rounded-xl overflow-hidden mb-6">
                <img src={opt.image} alt={opt.label} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className={`
                size-24 md:size-32 rounded-full flex items-center justify-center mb-6 transition-colors
                ${isActive ? 'bg-white/20' : 'bg-background-dark'}
              `}>
                <span className={`material-symbols-outlined text-6xl ${isActive ? 'text-white' : 'text-primary'}`}>
                  {opt.icon}
                </span>
              </div>
            )}
            
            <h3 className={`text-3xl md:text-4xl font-black ${isActive ? 'text-white' : 'text-gray-400'}`}>
              {opt.label}
            </h3>
            {opt.description && (
              <p className={`mt-2 text-lg font-medium ${isActive ? 'text-white/80' : 'text-gray-500'}`}>
                {opt.description}
              </p>
            )}

            {isActive && (
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/20">
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
  );
};

export default ScanningGrid;
