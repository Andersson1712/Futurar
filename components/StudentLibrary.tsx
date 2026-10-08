/**
 * StudentLibrary - Shows saved stories for a student
 * Displays a grid of story cards with scanning support
 */

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { getStudentBook, listStudentBooks } from '../services/backendBooks';
import { bookDetailToStory, bookSummaryToStory } from '../services/bookMappers';
import {
    designDetailToStory,
    designSummaryToStory,
    getStudentDesign,
    listStudentDesigns,
} from '../services/backendDesigns';
import {
    getStudentPresentation,
    listStudentPresentations,
    presentationDetailToStory,
    presentationSummaryToStory,
} from '../services/backendPresentations';
import {
    communicationDetailToStory,
    communicationSummaryToStory,
    getStudentCommunication,
    listStudentCommunications,
} from '../services/backendCommunications';
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
    kind: 'book' | 'design' | 'presentation' | 'communication' | 'legacy';
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
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

    const visibleEntries = useMemo(
        () =>
            showFavoritesOnly
                ? entries.filter(({ story }) => story.is_favorite)
                : entries,
        [entries, showFavoritesOnly],
    );

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

            // Diseños (SPEC-029) merge read-only alongside books.
            let designStories: Story[] = [];
            try {
                const summaries = await listStudentDesigns(studentId);
                designStories = summaries.map((summary) =>
                    designSummaryToStory(summary, studentId),
                );
            } catch (e) {
                console.warn('Backend designs unavailable:', e);
            }

            // Presentaciones (SPEC-029B) merge read-only alongside books.
            let presentationStories: Story[] = [];
            try {
                const summaries = await listStudentPresentations(studentId);
                presentationStories = summaries.map((summary) =>
                    presentationSummaryToStory(summary, studentId),
                );
            } catch (e) {
                console.warn('Backend presentations unavailable:', e);
            }

            // Tableros (SPEC-029C) merge read-only alongside books.
            let communicationStories: Story[] = [];
            try {
                const summaries = await listStudentCommunications(studentId);
                communicationStories = summaries.map((summary) =>
                    communicationSummaryToStory(summary, studentId),
                );
            } catch (e) {
                console.warn('Backend boards unavailable:', e);
            }

            setEntries([
                ...backendStories.map((story) => ({
                    story,
                    isBackend: true,
                    kind: 'book' as const,
                })),
                ...designStories.map((story) => ({
                    story,
                    isBackend: true,
                    kind: 'design' as const,
                })),
                ...presentationStories.map((story) => ({
                    story,
                    isBackend: true,
                    kind: 'presentation' as const,
                })),
                ...communicationStories.map((story) => ({
                    story,
                    isBackend: true,
                    kind: 'communication' as const,
                })),
                ...legacyStories.map((story) => ({
                    story,
                    isBackend: false,
                    kind: 'legacy' as const,
                })),
            ]);
            setIsLoading(false);
        };

        void fetchStories();
    }, [studentId]);

    // Convert stories to scan options
    const storyOptions: ScanOption[] = useMemo(() => {
        const options: ScanOption[] = visibleEntries.map(({ story }) => ({
            id: story.id,
            label: story.title,
            icon:
                story.type === 'design'
                    ? 'brush'
                    : story.type === 'presentation'
                      ? 'slideshow'
                      : story.type === 'communication'
                        ? 'forum'
                        : 'auto_stories',
            image: story.image_url || undefined,
            description:
                story.type === 'design'
                    ? story.content || t('library.designDescription')
                    : story.type === 'presentation'
                      ? story.content || t('library.presentationDescription')
                      : story.type === 'communication'
                        ? story.content || t('library.communicationDescription')
                        : story.protagonist
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
    }, [visibleEntries]);

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
            if (entry.kind === 'design') {
                const design = await getStudentDesign(entry.story.id);
                onSelectStory(designDetailToStory(design, studentId));
            } else if (entry.kind === 'presentation') {
                const presentation = await getStudentPresentation(entry.story.id);
                onSelectStory(presentationDetailToStory(presentation, studentId));
            } else if (entry.kind === 'communication') {
                const board = await getStudentCommunication(entry.story.id);
                onSelectStory(communicationDetailToStory(board, studentId));
            } else {
                const book = await getStudentBook(entry.story.id);
                onSelectStory(bookDetailToStory(book, studentId));
            }
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

    const openingEntry = openingId
        ? entries.find((item) => item.story.id === openingId)
        : undefined;

    // Loading state
    if (isLoading || openingId) {
        return (
            <div className="w-full max-w-4xl mx-auto text-center py-16">
                <span className="material-symbols-outlined text-6xl text-primary animate-spin">
                    progress_activity
                </span>
                <p className="mt-4 text-lg text-gray-400">
                    {openingId
                        ? openingEntry?.kind === 'design'
                            ? t('library.openDesign')
                            : openingEntry?.kind === 'presentation'
                              ? t('library.openPresentation')
                              : openingEntry?.kind === 'communication'
                                ? t('library.openCommunication')
                                : t('library.openStory')
                        : t('library.loading')}
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
                    {visibleEntries.length}{' '}
                    {visibleEntries.length === 1 ? 'cuento' : 'cuentos'} guardados
                </p>
                <button
                    type="button"
                    onClick={() => setShowFavoritesOnly((prev) => !prev)}
                    aria-pressed={showFavoritesOnly}
                    className={`mt-4 min-h-11 px-5 py-3 rounded-xl border-2 font-bold inline-flex items-center gap-2 transition-all ${
                        showFavoritesOnly
                            ? 'border-primary bg-primary/20 text-white'
                            : 'border-white/10 hover:border-white/30 text-gray-400'
                    }`}
                >
                    <span className="material-symbols-outlined">
                        {showFavoritesOnly ? 'star' : 'star_border'}
                    </span>
                    {showFavoritesOnly
                        ? t('library.all')
                        : t('library.favorites')}
                </button>
            </div>

            {visibleEntries.length === 0 ? (
                <div className="text-center py-12">
                    <span className="material-symbols-outlined text-6xl text-gray-600">
                        star_border
                    </span>
                    <p className="mt-4 text-lg text-gray-400">
                        {t('library.favorites')}: 0
                    </p>
                    <button
                        type="button"
                        onClick={() => setShowFavoritesOnly(false)}
                        className="mt-6 px-6 py-3 min-h-11 bg-primary rounded-xl font-bold hover:bg-primary/80 transition-colors"
                    >
                        {t('library.all')}
                    </button>
                </div>
            ) : (
                <ScanningGrid
                    options={storyOptions}
                    onSelect={handleSelect}
                    columns={Math.min(3, storyOptions.length)}
                    scanInterval={scanInterval}
                    soundEnabled={soundEnabled}
                    voiceEnabled={voiceEnabled}
                    isPaused={isPaused}
                />
            )}
        </div>
    );
};

export default StudentLibrary;
