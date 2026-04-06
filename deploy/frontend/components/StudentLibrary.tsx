/**
 * StudentLibrary - Shows saved stories for a student
 * Displays a grid of story cards with scanning support
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import ScanningGrid from './ScanningGrid';
import { speak, stopSpeaking } from '../utils/speech';
import type { Story } from '../types/database';
import type { ScanOption } from '../types';

interface StudentLibraryProps {
    studentId: string;
    studentName: string;
    scanInterval?: number;
    voiceEnabled?: boolean;
    soundEnabled?: boolean;
    isPaused?: boolean;
    onSelectStory: (story: Story) => void;
    onBack: () => void;
}

const StudentLibrary: React.FC<StudentLibraryProps> = ({
    studentId,
    studentName,
    scanInterval = 3000,
    voiceEnabled = true,
    soundEnabled = true,
    isPaused = false,
    onSelectStory,
    onBack,
}) => {
    const [stories, setStories] = useState<Story[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch stories for this student
    useEffect(() => {
        const fetchStories = async () => {
            try {
                setIsLoading(true);
                const { data, error: dbError } = await supabase
                    .from('stories')
                    .select('*')
                    .eq('student_id', studentId)
                    .order('created_at', { ascending: false });

                if (dbError) throw dbError;
                setStories(data || []);
            } catch (e: any) {
                console.error('Error loading stories:', e);
                setError(e.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStories();
    }, [studentId]);

    // Convert stories to scan options
    const storyOptions: ScanOption[] = useMemo(() => {
        const options: ScanOption[] = stories.map(story => ({
            id: story.id,
            label: story.title,
            icon: story.type === 'design' ? 'brush' : 'auto_stories',
            image: story.image_url || undefined,
            description: `${story.protagonist} en ${story.scenery}`,
        }));

        // Add "Back to Menu" option at the end
        options.push({
            id: 'back',
            label: 'Volver al Menú',
            icon: 'arrow_back',
        });

        return options;
    }, [stories]);

    // Handle story selection
    const handleSelect = (opt: ScanOption) => {
        stopSpeaking();

        if (opt.id === 'back') {
            if (voiceEnabled) speak('Volviendo al menú');
            onBack();
            return;
        }

        const selectedStory = stories.find(s => s.id === opt.id);
        if (selectedStory) {
            if (voiceEnabled) speak(`Abriendo ${selectedStory.title}`);
            onSelectStory(selectedStory);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="w-full max-w-4xl mx-auto text-center py-16">
                <span className="material-symbols-outlined text-6xl text-primary animate-spin">
                    progress_activity
                </span>
                <p className="mt-4 text-lg text-gray-400">Cargando tu biblioteca...</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="w-full max-w-4xl mx-auto text-center py-16">
                <span className="material-symbols-outlined text-6xl text-red-400">error</span>
                <p className="mt-4 text-lg text-red-400">Error: {error}</p>
                <button
                    onClick={onBack}
                    className="mt-6 px-6 py-3 bg-primary rounded-xl font-bold hover:bg-primary/80 transition-colors"
                >
                    Volver al Menú
                </button>
            </div>
        );
    }

    // Empty state
    if (stories.length === 0) {
        return (
            <div className="w-full max-w-4xl mx-auto text-center py-16">
                <div className="mb-8">
                    <span className="material-symbols-outlined text-8xl text-gray-600">
                        library_books
                    </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black mb-4">
                    Tu biblioteca está vacía
                </h2>
                <p className="text-gray-400 text-lg mb-8">
                    ¡Crea tu primer cuento y aparecerá aquí!
                </p>
                <button
                    onClick={onBack}
                    className="px-8 py-4 bg-primary rounded-2xl font-bold text-lg hover:bg-primary/80 transition-all hover:scale-105 flex items-center gap-3 mx-auto"
                >
                    <span className="material-symbols-outlined">auto_stories</span>
                    Crear mi primer cuento
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-5xl mx-auto">
            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-2xl md:text-4xl font-black mb-2 animate-fade-in">
                    📚 Mi Biblioteca
                </h2>
                <p className="text-gray-400">
                    {stories.length} {stories.length === 1 ? 'cuento' : 'cuentos'} guardados
                </p>
            </div>

            {/* Stories Grid */}
            <ScanningGrid
                options={storyOptions}
                onSelect={handleSelect}
                columns={Math.min(3, storyOptions.length)}
                scanInterval={scanInterval}
                soundEnabled={soundEnabled}
                voiceEnabled={voiceEnabled}
                isPaused={isPaused}
            />
        </div>
    );
};

export default StudentLibrary;
