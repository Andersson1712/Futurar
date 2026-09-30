import React, { useState } from 'react';

interface GlobalConfigModalProps {
    onClose: () => void;
    teacherId: string;
}

interface StorySettings {
    storySize: 'small' | 'medium' | 'large';
    customStructure: string;
}

const STORY_SIZES = [
    { id: 'small', name: 'Pequeño', pages: 5, description: 'Ideal para niños pequeños o lecturas rápidas' },
    { id: 'medium', name: 'Mediano', pages: 10, description: 'Desarrollo completo de la historia' },
    { id: 'large', name: 'Grande', pages: 15, description: 'Cuento extenso con muchos detalles' },
];

const STORAGE_KEY = 'futurar_story_config';

const loadStorySettings = (): StorySettings => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as Partial<StorySettings>;
            return {
                storySize: parsed.storySize === 'small' || parsed.storySize === 'large' ? parsed.storySize : 'medium',
                customStructure: parsed.customStructure || '',
            };
        }
    } catch (error) {
        console.error('Error reading story settings:', error);
    }
    return { storySize: 'medium', customStructure: '' };
};

/**
 * Story generation settings.
 * AI provider selection and API keys are owned by the backend (SPEC-001/SPEC-002).
 */
const GlobalConfigModal: React.FC<GlobalConfigModalProps> = ({ onClose }) => {
    const [storySize, setStorySize] = useState<StorySettings['storySize']>(() => loadStorySettings().storySize);
    const [customStructure, setCustomStructure] = useState(() => loadStorySettings().customStructure);

    const handleSave = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ storySize, customStructure }));
        } catch (error) {
            console.error('Error saving story settings:', error);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-surface-dark w-full max-w-2xl rounded-2xl border border-border-accent shadow-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-border-accent flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary" aria-hidden="true">auto_stories</span>
                        Configuración de Cuentos
                    </h2>
                    <button
                        onClick={onClose}
                        aria-label="Cerrar configuración"
                        className="p-2 min-w-11 min-h-11 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Tamaño del cuento */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                            Tamaño del Cuento
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {STORY_SIZES.map((size) => (
                                <button
                                    key={size.id}
                                    onClick={() => setStorySize(size.id as StorySettings['storySize'])}
                                    aria-pressed={storySize === size.id}
                                    className={`p-4 min-h-11 rounded-xl border-2 text-center transition-all ${storySize === size.id
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border-accent hover:border-gray-500 bg-background-dark/50'
                                        }`}
                                >
                                    <div className="text-3xl mb-2" aria-hidden="true">
                                        {size.id === 'small' ? '📖' : size.id === 'medium' ? '📚' : '📕'}
                                    </div>
                                    <div className="font-medium text-white">{size.name}</div>
                                    <div className="text-2xl font-bold text-primary">{size.pages}</div>
                                    <div className="text-xs text-gray-400">páginas</div>
                                </button>
                            ))}
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            {STORY_SIZES.find(s => s.id === storySize)?.description}
                        </p>
                    </div>

                    {/* Estructura personalizada */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Estructura Personalizada del Cuento
                            <span className="text-gray-500 font-normal ml-2">(opcional)</span>
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                            Describe cómo quieres que se estructure el cuento. Esto se aplicará además de la
                            selección de protagonista, escenario y misión.
                        </p>
                        <textarea
                            value={customStructure}
                            onChange={(e) => setCustomStructure(e.target.value)}
                            className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none resize-none"
                            rows={5}
                            placeholder="Ejemplo: 
- Inicia con una introducción mágica
- Incluye un compañero animal para el protagonista  
- Agrega un momento de suspenso antes del clímax
- Termina con una moraleja sobre la amistad"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border-accent bg-background-dark/50 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 min-h-11 hover:bg-white/10 rounded-lg font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 min-h-11 bg-primary hover:bg-primary/80 rounded-lg font-bold transition-colors"
                    >
                        Guardar Configuración
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GlobalConfigModal;
