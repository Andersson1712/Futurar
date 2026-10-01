/**
 * StudentLibrary - Shows saved stories for a student
 * Displays a grid of story cards with scanning support
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { getStudentBook, listStudentBooks } from '../services/backendBooks';
import { bookDetailToStory, bookSummaryToStory } from '../services/bookMappers';
import { MESSAGES, messageForErrorCode, t } from '../utils/messages';
import { ApiError, NetworkError } from '../services/backendApi';
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

interface LibraryEntry {
    story: Story;
    isBackend: boolean;
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
    const [entries, setEntries] = useState<LibraryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [openingId, setOpeningId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Backend books (SPEC-008) + legacy Supabase stories, read-only.
    useEffect(() => {
        const fetchStories = async () => {
            setIsLoading(true);
            setError(null);

            let legacyStories: Story[] = [];
            try {
                const { data, error: dbError } = await supabase
                    .from('stories')
                    .select('*')
                    .eq('student_id', studentId)
                    .order('created_at', { ascending: false });

                if (dbError) throw dbError;
                legacyStories = data ?? [];
            } catch (e) {
                console.error('Error loading legacy stories:', e);
            }

            let backendStories: Story[] = [];
            try {
                const summaries = await listStudentBooks(studentId);
                backendStories = summaries.map((summary) =>
                    bookSummaryToStory(summary, studentId),
                );
            } catch (e) {
                console.warn('Backend library unavailable:', e);
            }

            setEntries([
                ...backendStories.map((story) => ({ story, isBackend: true })),
                ...legacyStories.map((story) => ({ story, isBackend: false })),
            ]);
            setIsLoading(false);
        };

        void fetchStories();
    }, [studentId]);

    // Convert stories to scan options
    const storyOptions: ScanOption[] = useMemo(() => {
        const options: ScanOption[] = entries.map(({ story }) => ({
            id: story.id,
            label: story.title,
            icon: story.type === 'design' ? 'brush' : 'auto_stories',
            image: story.image_url || undefined,
            description: story.protagonist
                ? `${story.protagonist} en ${story.scenery}`
                : 'Cuento guardado',
        }));

        // Add "Back to Menu" option at the end
        options.push({
            id: 'back',
            label: t('library.backToMenu'),
            icon: 'arrow_back',
        });

        return options;
    }, [entries]);

    // Handle story selection: backend books need their detail first
    const handleSelect = async (opt: ScanOption) => {
        stopSpeaking();

        if (opt.id === 'back') {
            if (voiceEnabled) speak('Volviendo al menú');
            onBack();
            return;
        }

        const entry = entries.find((item) => item.story.id === opt.id);
        if (!entry) return;

        if (voiceEnabled) speak(`Abriendo ${entry.story.title}`);

        if (!entry.isBackend) {
            onSelectStory(entry.story);
            return;
        }

        setOpeningId(entry.story.id);
        try {
            const book = await getStudentBook(entry.story.id);
            onSelectStory(bookDetailToStory(book, studentId));
        } catch (e) {
            const message =
                e instanceof ApiError
                    ? messageForErrorCode(e.code)
                    : e instanceof NetworkError
                      ? MESSAGES.errors.network
                      : MESSAGES.errors.libraryUnavailable;
            setError(message);
        } finally {
            setOpeningId(null);
        }
    };

    // Loading state
    if (isLoading || openingId) {
        return (
            <div className="w-full max-w-4xl mx-auto text-center py-16">
                <span className="material-symbols-outlined text-6xl text-primary animate-spin">
                    progress_activity
                </span>
                <p className="mt-4 text-lg text-gray-400">
                    {openingId ? t('library.openStory') : t('library.loading')}
                </p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="w-full max-w-4xl mx-auto text-center py-16">
                <span className="material-symbols-outlined text-6xl text-red-400">error</span>
                <p className="mt-4 text-lg text-red-400" role="alert">{error}</p>
                <button
                    onClick={onBack}
                    className="mt-6 px-6 py-3 min-h-11 bg-primary rounded-xl font-bold hover:bg-primary/80 transition-colors"
                >
                    {t('library.backToMenu')}
                </button>
            </div>
        );
    }

    // Empty state
    if (entries.length === 0) {
        return (
            <div className="w-full max-w-4xl mx-auto text-center py-16">
                <div className="mb-8">
                    <span className="material-symbols-outlined text-8xl text-gray-600">
                        library_books
                    </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-black mb-4">
                    {t('library.emptyTitle')}
                </h2>
                <p className="text-gray-400 text-lg mb-8">
                    {t('library.emptyHint')}
                </p>
                <button
                    onClick={onBack}
                    className="px-8 py-4 min-h-11 bg-primary rounded-2xl font-bold text-lg hover:bg-primary/80 transition-all hover:scale-105 flex items-center gap-3 mx-auto"
                >
                    <span className="material-symbols-outlined">auto_stories</span>
                    {t('library.createFirst')}
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
                    {entries.length} {entries.length === 1 ? 'cuento' : 'cuentos'} guardados
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
