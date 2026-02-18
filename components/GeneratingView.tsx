import React, { useState, useEffect } from 'react';

interface GeneratingViewProps {
    progress: {
        status: string;
        progress: number;
    };
    protagonist: string;
    scenery: string;
    mission: string;
    error: string | null;
    onCancel: () => void;
}

const FUN_MESSAGES = [
    { text: '✨ Mezclando personajes e ingredientes mágicos...', icon: 'blender' },
    { text: '🏰 Construyendo el escenario de tu aventura...', icon: 'landscape' },
    { text: '📖 Escribiendo los primeros capítulos...', icon: 'edit_note' },
    { text: '🎨 Pintando las escenas con colores vibrantes...', icon: 'palette' },
    { text: '🦸 Dando vida al protagonista de tu historia...', icon: 'person_celebrate' },
    { text: '🗺️ Trazando el mapa de la aventura...', icon: 'map' },
    { text: '💫 Añadiendo magia y sorpresas al cuento...', icon: 'auto_awesome' },
    { text: '🎵 Componiendo la melodía de la historia...', icon: 'music_note' },
    { text: '🔮 La inteligencia artificial está soñando tu cuento...', icon: 'psychology' },
    { text: '📚 Revisando que cada detalle sea perfecto...', icon: 'fact_check' },
    { text: '🌟 Casi listo... puliendo los últimos detalles...', icon: 'star' },
];

const GeneratingView: React.FC<GeneratingViewProps> = ({
    progress,
    protagonist,
    scenery,
    mission,
    error,
    onCancel
}) => {
    const [funMsgIndex, setFunMsgIndex] = useState(0);
    const [fadeIn, setFadeIn] = useState(true);

    // Rotate fun messages every 3.5 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            setFadeIn(false);
            setTimeout(() => {
                setFunMsgIndex(prev => (prev + 1) % FUN_MESSAGES.length);
                setFadeIn(true);
            }, 400);
        }, 3500);

        return () => clearInterval(timer);
    }, []);

    const currentMsg = FUN_MESSAGES[funMsgIndex];

    return (
        <div className="flex flex-col items-center text-center max-w-lg w-full px-4">

            {/* Animated Icon Area */}
            <div className="relative mb-8 w-32 h-32 flex items-center justify-center">
                {/* Outer pulsing ring */}
                <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-2 rounded-full bg-primary/15 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />

                {/* Central icon container */}
                <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-blue-600/30 border border-primary/30 flex items-center justify-center animate-pulse">
                    <span
                        className="material-symbols-outlined text-5xl text-primary transition-all duration-400"
                        style={{ opacity: fadeIn ? 1 : 0 }}
                    >
                        {currentMsg.icon}
                    </span>
                </div>

                {/* Floating sparkles */}
                {[...Array(6)].map((_, i) => (
                    <span
                        key={i}
                        className="absolute text-yellow-400 text-sm animate-float-sparkle"
                        style={{
                            top: `${15 + Math.sin(i * 1.05) * 40}%`,
                            left: `${15 + Math.cos(i * 1.05) * 40}%`,
                            animationDelay: `${i * 0.5}s`,
                            animationDuration: `${2 + i * 0.3}s`,
                        }}
                    >
                        ✦
                    </span>
                ))}
            </div>

            {/* Title */}
            <h2 className="text-3xl md:text-4xl font-black mb-3 bg-gradient-to-r from-white to-primary bg-clip-text text-transparent">
                Creando tu historia...
            </h2>

            {/* Status message from API */}
            <p className="text-sm text-gray-500 mb-4 min-h-[1.5em]">
                {progress.status || 'Conectando con la IA...'}
            </p>

            {/* Rotating fun messages */}
            <div className="min-h-[3em] flex items-center justify-center mb-6">
                <p
                    className={`text-lg text-primary/90 font-medium transition-all duration-400 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
                        }`}
                >
                    {currentMsg.text}
                </p>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden relative">
                <div
                    className="h-full bg-gradient-to-r from-primary via-blue-500 to-purple-500 transition-all duration-500 ease-out rounded-full relative"
                    style={{ width: `${Math.max(progress.progress, 5)}%` }}
                >
                    {/* Shimmer effect on progress bar */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </div>
            </div>
            <p className="text-xs text-gray-600 mt-2">{Math.round(progress.progress)}%</p>

            {/* Story config card */}
            <div className="mt-6 p-4 bg-slate-800/50 rounded-2xl border border-slate-700 w-full">
                <div className="flex flex-wrap justify-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-lg">person</span>
                        <span className="text-sm text-gray-400">
                            <span className="text-primary font-bold">{protagonist}</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-blue-400 text-lg">landscape</span>
                        <span className="text-sm text-gray-400">
                            <span className="text-blue-400 font-bold">{scenery}</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-green-400 text-lg">flag</span>
                        <span className="text-sm text-gray-400">
                            <span className="text-green-400 font-bold">{mission}</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Error Controls */}
            {error && (
                <div className="mt-6 animate-fade-in">
                    <button
                        onClick={onCancel}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 font-bold py-3 px-8 rounded-full transition-all flex items-center gap-2 mx-auto"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                        Volver al Menú
                    </button>
                </div>
            )}
        </div>
    );
};

export default GeneratingView;
