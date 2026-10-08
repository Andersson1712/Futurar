import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { listActiveProfiles, listProfileOptions, mapProfileSettings, mapProfileToStudent } from '../services/backendProfiles';
import ScanningGrid from './ScanningGrid';
import StoryReader from './StoryReader';
import StoryDetails from './StoryDetails';
import StudentLibrary from './StudentLibrary';
import FloatingControls from './FloatingControls';
import { ScanSettingsProvider, useScanSettings } from '../contexts/ScanSettingsContext';
import { useAccessibility } from '../contexts/AccessibilityContext';
import { fromStudentSettings } from '../utils/accessibility';
import { speak, stopSpeaking } from '../utils/speech';
import { MESSAGES, messageForErrorCode, t, type MessageKey } from '../utils/messages';
import { getRandomImage } from '../utils/images';
import { loadStorySettings } from '../utils/storySettings';
import {
    clearProgress,
    loadProgress,
    saveProgress,
    type ViewerProgress,
} from '../utils/progressStore';
import { ApiError, NetworkError } from '../services/backendApi';
import { followJob, requestBookGeneration } from '../services/bookGeneration';
import { bookToStory } from '../services/bookMappers';
import {
    DESIGN_MESSAGE_MAX_LENGTH,
    designDetailToStory,
    getStudentDesign,
    requestDesignGeneration,
    type DesignOccasion,
} from '../services/backendDesigns';
import {
    PRESENTATION_TOPIC_MAX_LENGTH,
    presentationDetailToStory,
    getStudentPresentation,
    requestPresentationGeneration,
    type PresentationSlideCount,
} from '../services/backendPresentations';
import {
    COMMUNICATION_TOPIC_MAX_LENGTH,
    communicationDetailToStory,
    getStudentCommunication,
    requestCommunicationGeneration,
    type CommunicationCellCount,
    type CommunicationDetailPayload,
    type CommunicationKind,
} from '../services/backendCommunications';
import { buildOptionPages, nextPageIndex } from '../utils/optionPages';
import type { Student, StudentSettings, Story } from '../types/database';
import type { ScanOption } from '../types';

// SPEC-023B: synthetic scan target that advances to the next options page.
const MORE_OPTIONS_ID = '__more_options__';

// Tipos locales
interface StoryConfig {
    id?: string;
    protagonist: string;
    scenery: string;
    mission: string;
    style: string;
    title?: string;
    content?: string;
    imageUrl?: string;
    type: 'story' | 'design' | 'presentation' | 'communication';
    dedication?: string;
    dedicationPosition?: 'start' | 'end';
    isFavorite?: boolean;
}

type AppStep =
    | 'PROFILE'
    | 'MENU'
    | 'LIBRARY'
    | 'SELECT_PROTAGONIST'
    | 'SELECT_SCENERY'
    | 'SELECT_MISSION'
    | 'SELECT_STYLE'
    | 'GENERATING'
    | 'SELECT_DESIGN_OCCASION'
    | 'SELECT_DESIGN_MESSAGE'
    | 'SELECT_DESIGN_STYLE'
    | 'GENERATING_DESIGN'
    | 'SELECT_PRESENTATION_TOPIC'
    | 'SELECT_PRESENTATION_SLIDE_COUNT'
    | 'SELECT_PRESENTATION_STYLE'
    | 'GENERATING_PRESENTATION'
    | 'SELECT_COMMUNICATION_KIND'
    | 'SELECT_COMMUNICATION_TOPIC'
    | 'SELECT_COMMUNICATION_CELL_COUNT'
    | 'SELECT_COMMUNICATION_STYLE'
    | 'GENERATING_COMMUNICATION'
    | 'BOARD_USE'
    | 'RESULT_VIEW'
    | 'STORY_DETAILS';

interface StudentWithSettings extends Student {
    student_settings: StudentSettings | null;
}

interface StudentAppProps {
    onSwitchToTeacher: () => void;
}

// Localized copy for entry failures (SPEC-024): never surface raw backend text.
function profileListErrorMessage(err: unknown): string {
    if (err instanceof ApiError) {
        return messageForErrorCode(err.code);
    }
    if (err instanceof NetworkError) {
        return MESSAGES.errors.network;
    }
    return MESSAGES.errors.generic;
}

// Inner component that uses the context
const StudentAppInner: React.FC<StudentAppProps> = ({ onSwitchToTeacher }) => {
    const [step, setStep] = useState<AppStep>('PROFILE');
    const [students, setStudents] = useState<StudentWithSettings[]>([]);
    const [currentStudent, setCurrentStudent] = useState<StudentWithSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [generationProgress, setGenerationProgress] = useState({ status: '', progress: 0 });
    const [config, setConfig] = useState<StoryConfig>({
        protagonist: '',
        scenery: '',
        mission: '',
        style: '',
        type: 'story'
    });
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [designInput, setDesignInput] = useState({
        occasion: '' as DesignOccasion | '',
        occasionLabel: '',
        message: '',
        style: '',
    });
    const [presentationInput, setPresentationInput] = useState({
        topic: '',
        slideCount: 0 as PresentationSlideCount | 0,
        slideCountLabel: '',
        style: '',
    });
    const [communicationInput, setCommunicationInput] = useState({
        kind: '' as CommunicationKind | '',
        kindLabel: '',
        topic: '',
        cellCount: 0 as CommunicationCellCount | 0,
        cellCountLabel: '',
        style: '',
    });
    const [boardDetail, setBoardDetail] = useState<CommunicationDetailPayload | null>(null);
    const [lastSpokenCell, setLastSpokenCell] = useState('');
    const [isRestored, setIsRestored] = useState(false);
    const [initialScrollTop, setInitialScrollTop] = useState(0);
    const viewerProgressRef = useRef<ViewerProgress | undefined>(undefined);

    // Get ONLY pause state from context (for FloatingControls)
    // DO NOT sync student settings to context - this causes infinite render loops
    const {
        isPaused,
        isModalOpen,
        scanInterval,
        voiceEnabled,
        soundEnabled,
        scanColumns,
        applyProfileSettings,
    } = useScanSettings();

    // The scan pauses while the controls menu (modal) is open (SPEC-013)
    const scanningPaused = isPaused || isModalOpen;

    // Profile accessibility settings applied app-wide (SPEC-015)
    const accessibility = useMemo(
        () => fromStudentSettings(currentStudent?.student_settings),
        [currentStudent?.student_settings]
    );

    useAccessibility(currentStudent ? accessibility : null);

    useEffect(() => {
        if (!currentStudent) return;

        applyProfileSettings({
            scanInterval: accessibility.scanInterval,
            scanColumns: accessibility.scanColumns,
            voiceEnabled: accessibility.voiceFeedback,
            soundEnabled: accessibility.soundEnabled,
            sweepEnabled: accessibility.sweepEnabled,
            inputMode: accessibility.inputMode,
        });
    }, [currentStudent, accessibility, applyProfileSettings]);

    // Cargar estudiantes (SPEC-024: entrada pública del quiosco, sin login)
    useEffect(() => {
        const controller = new AbortController();
        let cancelled = false;

        const loadStudents = async () => {
            try {
                const profiles = await listActiveProfiles(controller.signal);

                if (cancelled) return;

                const processedData = profiles.map(profile => ({
                    ...mapProfileToStudent(profile),
                    student_settings: mapProfileSettings(profile.settings),
                })) as StudentWithSettings[];

                setStudents(processedData);
            } catch (err) {
                if (cancelled) return;
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }
                console.error('Error cargando estudiantes:', err);
                setError(profileListErrorMessage(err));
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };
        loadStudents();

        return () => {
            cancelled = true;
            controller.abort();
        };
    }, []);

    // Restore wizard/viewer progress (SPEC-014)
    useEffect(() => {
        if (isRestored || isLoading || students.length === 0) return;

        const progress = loadProgress();

        if (progress) {
            const student = students.find((item) => item.id === progress.studentId);

            if (student) {
                const restoredConfig: StoryConfig = {
                    id: progress.config.id,
                    protagonist: progress.config.protagonist,
                    scenery: progress.config.scenery,
                    mission: progress.config.mission,
                    style: progress.config.style,
                    title: progress.config.title,
                    content: progress.config.content,
                    imageUrl: progress.config.imageUrl,
                    type: progress.config.type,
                };

                setCurrentStudent(student);
                setConfig(restoredConfig);

                const needsContent =
                    progress.step === 'STORY_DETAILS' ||
                    progress.step === 'RESULT_VIEW';

                if (!needsContent || restoredConfig.content) {
                    setStep(progress.step as AppStep);
                }

                if (progress.viewer && progress.viewer.storyId === restoredConfig.id) {
                    setInitialScrollTop(progress.viewer.scrollTop);
                    viewerProgressRef.current = progress.viewer;
                }
            }
        }

        setIsRestored(true);
    }, [isRestored, isLoading, students]);

    // Autosave progress (SPEC-014): debounced on state changes and on exit
    const persistProgress = useCallback(() => {
        if (
            !currentStudent ||
            step === 'PROFILE' ||
            step === 'GENERATING' ||
            step === 'GENERATING_DESIGN'
        ) {
            return;
        }

        saveProgress({
            studentId: currentStudent.id,
            step,
            config: { ...config },
            viewer: viewerProgressRef.current,
            updatedAt: new Date().toISOString(),
        });
    }, [currentStudent, step, config]);

    useEffect(() => {
        if (!isRestored) return;

        const timeout = setTimeout(persistProgress, 300);
        return () => clearTimeout(timeout);
    }, [isRestored, persistProgress]);

    useEffect(() => {
        const handlePageHide = () => persistProgress();
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') persistProgress();
        };

        window.addEventListener('pagehide', handlePageHide);
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('pagehide', handlePageHide);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [persistProgress]);

    const handleViewerScroll = useCallback(
        (scrollTop: number) => {
            if (!config.id) return;

            viewerProgressRef.current = { storyId: config.id, scrollTop };
            persistProgress();
        },
        [config.id, persistProgress]
    );

    // TTS Helper - uses shared utility with callbacks for isSpeaking state
    const speakWithState = (text: string) => {
        if (!voiceEnabled || isPaused) return;
        speak(text, {
            onStart: () => setIsSpeaking(true),
            onEnd: () => setIsSpeaking(false),
        });
    };

    const handleStopSpeaking = () => {
        stopSpeaking();
        setIsSpeaking(false);
    };

    // Opciones de selección mejoradas
    const profileOptions: ScanOption[] = useMemo(() => {
        if (students.length > 0) {
            return students.map(s => ({
                id: s.id,
                label: s.name,
                icon: s.avatar_icon || 'face'
            }));
        }
        return [];
    }, [students]);

    const menuOptions: ScanOption[] = [
        { id: 'story', label: t('wizard.createStory'), icon: 'auto_stories' },
        { id: 'library', label: t('wizard.library'), icon: 'collections_bookmark' },
        { id: 'design', label: t('wizard.design'), icon: 'brush' },
        { id: 'presentation', label: t('wizard.presentation'), icon: 'slideshow' },
        { id: 'communication', label: t('wizard.communication'), icon: 'forum' }
    ];

    // SPEC-029: fixed flyer occasions (backend enum) as scan options.
    const designOccasionOptions: ScanOption[] = useMemo(() => {
        const occasions: Array<{
            value: DesignOccasion;
            labelKey: MessageKey;
            icon: string;
        }> = [
            { value: 'event', labelKey: 'wizard.designOccasionEvent', icon: 'celebration' },
            { value: 'birthday', labelKey: 'wizard.designOccasionBirthday', icon: 'cake' },
            { value: 'announcement', labelKey: 'wizard.designOccasionAnnouncement', icon: 'campaign' },
            { value: 'invitation', labelKey: 'wizard.designOccasionInvitation', icon: 'mail' },
            { value: 'other', labelKey: 'wizard.designOccasionOther', icon: 'more_horiz' },
        ];

        return occasions.map((item) => ({
            id: item.value,
            label: t(item.labelKey),
            icon: item.icon,
        }));
    }, []);

    // SPEC-029B: fixed slide counts (backend enum) as scan options.
    const presentationSlideCountOptions: ScanOption[] = useMemo(() => {
        const counts: Array<{
            value: PresentationSlideCount;
            labelKey: MessageKey;
            icon: string;
        }> = [
            { value: 5, labelKey: 'wizard.presentationSlideCount5', icon: 'filter_5' },
            { value: 8, labelKey: 'wizard.presentationSlideCount8', icon: 'filter_8' },
            { value: 10, labelKey: 'wizard.presentationSlideCount10', icon: 'filter_10' },
        ];

        return counts.map((item) => ({
            id: String(item.value),
            label: t(item.labelKey),
            icon: item.icon,
        }));
    }, []);

    // SPEC-029C: fixed board kinds (backend enum) as scan options.
    const communicationKindOptions: ScanOption[] = useMemo(() => {
        const kinds: Array<{
            value: CommunicationKind;
            labelKey: MessageKey;
            icon: string;
        }> = [
            { value: 'feelings', labelKey: 'wizard.communicationKindFeelings', icon: 'mood' },
            { value: 'help', labelKey: 'wizard.communicationKindHelp', icon: 'help' },
            { value: 'custom', labelKey: 'wizard.communicationKindCustom', icon: 'edit' },
        ];

        return kinds.map((item) => ({
            id: item.value,
            label: t(item.labelKey),
            icon: item.icon,
        }));
    }, []);

    // SPEC-029C: fixed cell counts (backend enum) as scan options.
    const communicationCellCountOptions: ScanOption[] = useMemo(() => {
        const counts: Array<{
            value: CommunicationCellCount;
            labelKey: MessageKey;
            icon: string;
        }> = [
            { value: 4, labelKey: 'wizard.communicationCellCount4', icon: 'filter_4' },
            { value: 6, labelKey: 'wizard.communicationCellCount6', icon: 'filter_6' },
            { value: 8, labelKey: 'wizard.communicationCellCount8', icon: 'filter_8' },
        ];

        return counts.map((item) => ({
            id: String(item.value),
            label: t(item.labelKey),
            icon: item.icon,
        }));
    }, []);

    // State for student-specific elements (loaded from database)
    const [studentProtagonists, setStudentProtagonists] = useState<ScanOption[]>([]);
    const [studentScenarios, setStudentScenarios] = useState<ScanOption[]>([]);
    const [studentMissions, setStudentMissions] = useState<ScanOption[]>([]);
    const [studentStyles, setStudentStyles] = useState<ScanOption[]>([]);
    const [elementsLoaded, setElementsLoaded] = useState(false);

    // Load student elements when student changes
    useEffect(() => {
        const loadStudentElements = async () => {
            if (!currentStudent?.id) {
                setElementsLoaded(false);
                return;
            }

            try {
                const options = await listProfileOptions(currentStudent.id);

                setStudentProtagonists(options.protagonists.map(p => ({ id: p.id, label: p.label, icon: p.icon, level: p.level })));
                setStudentScenarios(options.scenarios.map(s => ({ id: s.id, label: s.label, icon: s.icon, level: s.level })));
                setStudentMissions(options.missions.map(m => ({ id: m.id, label: m.label, icon: m.icon, level: m.level })));
                setStudentStyles(options.styles.map(st => ({ id: st.id, label: st.label, icon: st.icon, level: st.level })));
                setElementsLoaded(true);
            } catch (err) {
                console.error('Error loading student elements:', err);
                // Fallback to defaults if database fails
                setStudentProtagonists([
                    { id: 'animales', label: 'Animales', icon: 'pets' },
                    { id: 'personas', label: 'Personas', icon: 'face_6' },
                    { id: 'robots', label: 'Robots', icon: 'smart_toy' },
                    { id: 'fantasia', label: 'Fantasía', icon: 'auto_fix' }
                ]);
                setStudentScenarios([
                    { id: 'selva', label: 'Selva', icon: 'forest' },
                    { id: 'espacio', label: 'Espacio', icon: 'rocket_launch' },
                    { id: 'castillo', label: 'Castillo', icon: 'castle' },
                    { id: 'mar', label: 'Bajo el Mar', icon: 'water' }
                ]);
                setStudentMissions([
                    { id: 'explorar', label: 'Explorar', icon: 'explore' },
                    { id: 'rescatar', label: 'Rescatar', icon: 'volunteer_activism' },
                    { id: 'descubrir', label: 'Descubrir', icon: 'search' },
                    { id: 'proteger', label: 'Proteger', icon: 'shield' }
                ]);
                setStudentStyles([
                    { id: 'acuarela', label: 'Acuarela', icon: 'water_drop' },
                    { id: 'cartoon', label: 'Cartoon', icon: 'animation' },
                    { id: 'realista', label: 'Realista', icon: 'camera' },
                    { id: 'pixel', label: 'Pixel Art', icon: 'grid_on' }
                ]);
                setElementsLoaded(true);
            }
        };

        loadStudentElements();
    }, [currentStudent?.id]);

    const protagonistOptions: ScanOption[] = studentProtagonists;
    const sceneryOptions: ScanOption[] = studentScenarios;
    const missionOptions: ScanOption[] = studentMissions;
    const styleOptions: ScanOption[] = studentStyles;

    // SPEC-023B: split the wizard options into scan pages by level.
    const [optionPage, setOptionPage] = useState(0);
    const wizardRawOptions: ScanOption[] =
        step === 'MENU' ? menuOptions :
            step === 'SELECT_PROTAGONIST' ? protagonistOptions :
                step === 'SELECT_SCENERY' ? sceneryOptions :
                    step === 'SELECT_MISSION' ? missionOptions :
                        step === 'SELECT_STYLE' ? styleOptions :
                            step === 'SELECT_DESIGN_OCCASION' ? designOccasionOptions :
                                step === 'SELECT_DESIGN_STYLE' ? styleOptions :
                                    step === 'SELECT_PRESENTATION_SLIDE_COUNT' ? presentationSlideCountOptions :
                                        step === 'SELECT_PRESENTATION_STYLE' ? styleOptions :
                                            step === 'SELECT_COMMUNICATION_KIND' ? communicationKindOptions :
                                                step === 'SELECT_COMMUNICATION_CELL_COUNT' ? communicationCellCountOptions :
                                                    step === 'SELECT_COMMUNICATION_STYLE' ? styleOptions :
                                                        [];
    const wizardPages = buildOptionPages(wizardRawOptions);
    const pageCount = wizardPages.length;
    const safePage = pageCount === 0 ? 0 : Math.min(optionPage, pageCount - 1);
    const currentPageOptions = wizardPages[safePage]?.options ?? [];
    const pageOptions: ScanOption[] = pageCount > 1
        ? [...currentPageOptions, { id: MORE_OPTIONS_ID, label: t('wizard.moreOptions'), icon: 'more_horiz' }]
        : currentPageOptions;

    useEffect(() => {
        setOptionPage(0);
    }, [step, currentStudent?.id]);

    // Handlers
    const handleProfileSelect = (opt: ScanOption) => {
        const selectedStudent = students.find(s => s.id === opt.id);
        if (selectedStudent) {
            setCurrentStudent(selectedStudent);
            setStep('MENU');
            speakWithState(`Hola ${selectedStudent.name}, ¿qué quieres hacer hoy?`);
        }
    };

    const handleMenuSelect = (opt: ScanOption) => {
        if (opt.id === 'library') {
            speakWithState("Tu biblioteca de cuentos");
            setStep('LIBRARY');
            return;
        }
        if (opt.id === 'design') {
            setConfig(prev => ({ ...prev, type: 'design' }));
            speakWithState(t('wizard.designOccasionTitle'));
            setStep('SELECT_DESIGN_OCCASION');
            return;
        }
        if (opt.id === 'presentation') {
            setConfig(prev => ({ ...prev, type: 'presentation' }));
            speakWithState(t('wizard.presentationTopicTitle'));
            setStep('SELECT_PRESENTATION_TOPIC');
            return;
        }
        if (opt.id === 'communication') {
            setConfig(prev => ({ ...prev, type: 'communication' }));
            speakWithState(t('wizard.communicationKindTitle'));
            setStep('SELECT_COMMUNICATION_KIND');
            return;
        }
        setConfig(prev => ({ ...prev, type: opt.id as 'story' | 'design' | 'presentation' | 'communication' }));
        if (opt.id === 'story') {
            speakWithState("Elige tu protagonista");
            setStep('SELECT_PROTAGONIST');
        }
    };

    const handleProtagonistSelect = (opt: ScanOption) => {
        setConfig(prev => ({ ...prev, protagonist: opt.label }));
        speakWithState("Elige el escenario");
        setStep('SELECT_SCENERY');
    };

    const handleScenerySelect = (opt: ScanOption) => {
        setConfig(prev => ({ ...prev, scenery: opt.label }));
        speakWithState("Elige la misión");
        setStep('SELECT_MISSION');
    };

    const handleMissionSelect = (opt: ScanOption) => {
        setConfig(prev => ({ ...prev, mission: opt.label }));
        speakWithState("Elige el estilo");
        setStep('SELECT_STYLE');
    };

    const handleStyleSelect = (opt: ScanOption) => {
        setConfig(prev => ({ ...prev, style: opt.label }));
        setStep('GENERATING');
    };

    const handleDesignOccasionSelect = (opt: ScanOption) => {
        setDesignInput((prev) => ({
            ...prev,
            occasion: opt.id as DesignOccasion,
            occasionLabel: opt.label,
        }));
        speakWithState(t('wizard.designMessageTitle'));
        setStep('SELECT_DESIGN_MESSAGE');
    };

    const handleDesignStyleSelect = (opt: ScanOption) => {
        setDesignInput((prev) => ({ ...prev, style: opt.label }));
        setStep('GENERATING_DESIGN');
    };

    const handleDesignMessageNext = () => {
        if (!designInput.message.trim()) return;
        speakWithState(t('wizard.designStyleTitle'));
        setStep('SELECT_DESIGN_STYLE');
    };

    const handlePresentationTopicNext = () => {
        if (!presentationInput.topic.trim()) return;
        speakWithState(t('wizard.presentationSlideCountTitle'));
        setStep('SELECT_PRESENTATION_SLIDE_COUNT');
    };

    const handlePresentationSlideCountSelect = (opt: ScanOption) => {
        const slideCount = Number(opt.id) as PresentationSlideCount;
        if (slideCount !== 5 && slideCount !== 8 && slideCount !== 10) return;
        setPresentationInput((prev) => ({
            ...prev,
            slideCount,
            slideCountLabel: opt.label,
        }));
        speakWithState(t('wizard.presentationStyleTitle'));
        setStep('SELECT_PRESENTATION_STYLE');
    };

    const handlePresentationStyleSelect = (opt: ScanOption) => {
        setPresentationInput((prev) => ({ ...prev, style: opt.label }));
        setStep('GENERATING_PRESENTATION');
    };

    const handleCommunicationKindSelect = (opt: ScanOption) => {
        const kind = opt.id as CommunicationKind;
        if (kind !== 'feelings' && kind !== 'help' && kind !== 'custom') return;
        setCommunicationInput((prev) => ({
            ...prev,
            kind,
            kindLabel: opt.label,
        }));
        speakWithState(t('wizard.communicationTopicTitle'));
        setStep('SELECT_COMMUNICATION_TOPIC');
    };

    const handleCommunicationTopicNext = () => {
        if (!communicationInput.topic.trim()) return;
        speakWithState(t('wizard.communicationCellCountTitle'));
        setStep('SELECT_COMMUNICATION_CELL_COUNT');
    };

    const handleCommunicationCellCountSelect = (opt: ScanOption) => {
        const cellCount = Number(opt.id) as CommunicationCellCount;
        if (cellCount !== 4 && cellCount !== 6 && cellCount !== 8) return;
        setCommunicationInput((prev) => ({
            ...prev,
            cellCount,
            cellCountLabel: opt.label,
        }));
        speakWithState(t('wizard.communicationStyleTitle'));
        setStep('SELECT_COMMUNICATION_STYLE');
    };

    const handleCommunicationStyleSelect = (opt: ScanOption) => {
        setCommunicationInput((prev) => ({ ...prev, style: opt.label }));
        setStep('GENERATING_COMMUNICATION');
    };

    const handleBoardCellSelect = (opt: ScanOption) => {
        setLastSpokenCell(opt.label);
        speakWithState(opt.label);
    };

    const handleWizardSelect = (opt: ScanOption) => {
        if (opt.id === MORE_OPTIONS_ID) {
            const next = nextPageIndex(safePage, pageCount);
            setOptionPage(next);
            speakWithState(t('wizard.pageIndicator', { current: next + 1, total: pageCount }));
            return;
        }

        if (step === 'MENU') handleMenuSelect(opt);
        else if (step === 'SELECT_PROTAGONIST') handleProtagonistSelect(opt);
        else if (step === 'SELECT_SCENERY') handleScenerySelect(opt);
        else if (step === 'SELECT_MISSION') handleMissionSelect(opt);
        else if (step === 'SELECT_STYLE') handleStyleSelect(opt);
        else if (step === 'SELECT_DESIGN_OCCASION') handleDesignOccasionSelect(opt);
        else if (step === 'SELECT_DESIGN_STYLE') handleDesignStyleSelect(opt);
        else if (step === 'SELECT_PRESENTATION_SLIDE_COUNT') handlePresentationSlideCountSelect(opt);
        else if (step === 'SELECT_PRESENTATION_STYLE') handlePresentationStyleSelect(opt);
        else if (step === 'SELECT_COMMUNICATION_KIND') handleCommunicationKindSelect(opt);
        else if (step === 'SELECT_COMMUNICATION_CELL_COUNT') handleCommunicationCellCountSelect(opt);
        else if (step === 'SELECT_COMMUNICATION_STYLE') handleCommunicationStyleSelect(opt);
    };

    const handleBackToProfile = () => {
        console.log('🚪 handleBackToProfile called - setting step to PROFILE');
        handleStopSpeaking();
        clearProgress();
        viewerProgressRef.current = undefined;
        setInitialScrollTop(0);
        setStep('PROFILE');
        setCurrentStudent(null);
        setConfig({ protagonist: '', scenery: '', mission: '', style: '', type: 'story' });
        setDesignInput({ occasion: '', occasionLabel: '', message: '', style: '' });
        setPresentationInput({ topic: '', slideCount: 0, slideCountLabel: '', style: '' });
        setCommunicationInput({ kind: '', kindLabel: '', topic: '', cellCount: 0, cellCountLabel: '', style: '' });
        setBoardDetail(null);
        setLastSpokenCell('');
        setElementsLoaded(false);
        setStudentProtagonists([]);
        setStudentScenarios([]);
        setStudentMissions([]);
        setStudentStyles([]);
    };

    const handleBackToMenu = () => {
        handleStopSpeaking();
        setStep('MENU');
        setConfig({ protagonist: '', scenery: '', mission: '', style: '', type: 'story' });
        setDesignInput({ occasion: '', occasionLabel: '', message: '', style: '' });
        setPresentationInput({ topic: '', slideCount: 0, slideCountLabel: '', style: '' });
        setCommunicationInput({ kind: '', kindLabel: '', topic: '', cellCount: 0, cellCountLabel: '', style: '' });
        setBoardDetail(null);
        setLastSpokenCell('');
    };

    const handleBackToLibrary = () => {
        handleStopSpeaking();
        setBoardDetail(null);
        setLastSpokenCell('');
        setStep('LIBRARY');
    };

    const handleCreateAnother = () => {
        handleStopSpeaking();
        clearProgress();
        viewerProgressRef.current = undefined;
        setInitialScrollTop(0);
        setStep('SELECT_PROTAGONIST');
        setConfig(prev => ({ ...prev, id: undefined, protagonist: '', scenery: '', mission: '', style: '', content: '', title: '' }));
    };

    // Real generation through the Nest backend (SPEC-009).
    useEffect(() => {
        if (step !== 'GENERATING' || !currentStudent) return;

        const controller = new AbortController();
        setError(null);
        setGenerationProgress({ status: MESSAGES.generation.queued, progress: 10 });

        const run = async () => {
            const settings = loadStorySettings();
            const request = {
                protagonist: config.protagonist,
                scenery: config.scenery,
                mission: config.mission,
                style: config.style,
                storySize: settings.storySize,
                customStructure: settings.customStructure || undefined,
                audience: 'child' as const,
                profileId: currentStudent.id,
            };

            try {
                const job = await requestBookGeneration(request);
                const finalStatus = await followJob(job.jobId, {
                    signal: controller.signal,
                    onStatus: (status) => {
                        setGenerationProgress({
                            status:
                                status.status === 'completed'
                                    ? MESSAGES.generation.completed
                                    : MESSAGES.generation.processing,
                            progress:
                                status.progress ??
                                (status.status === 'queued' ? 15 : 60),
                        });
                    },
                });

                if (finalStatus.status === 'failed' || !finalStatus.book) {
                    throw new ApiError({
                        statusCode: 502,
                        code: finalStatus.error?.code ?? 'INTERNAL',
                        message:
                            finalStatus.error?.message ?? 'generation failed',
                    });
                }

                const story = bookToStory(finalStatus.book, {
                    protagonist: request.protagonist,
                    scenery: request.scenery,
                    mission: request.mission,
                    style: request.style,
                    studentId: currentStudent.id,
                });

                setConfig({
                    id: story.id,
                    protagonist: story.protagonist,
                    scenery: story.scenery,
                    mission: story.mission,
                    style: story.style,
                    title: story.title,
                    content: story.content ?? '',
                    imageUrl: story.image_url ?? undefined,
                    type: 'story',
                });
                setGenerationProgress({
                    status: MESSAGES.generation.completed,
                    progress: 100,
                });
                speakWithState(`Tu cuento ${story.title} está listo`);
                setStep('STORY_DETAILS');
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }

                const message =
                    err instanceof ApiError
                        ? messageForErrorCode(err.code)
                        : err instanceof NetworkError
                          ? MESSAGES.errors.network
                          : MESSAGES.errors.generic;

                setGenerationProgress({
                    status: MESSAGES.generation.failed,
                    progress: 0,
                });
                setError(message);
                speakWithState(message);
                // SPEC-024: never park the UI on the GENERATING spinner.
                // Back to style selection so the student can retry.
                setStep('SELECT_STYLE');
            }
        };

        void run();

        return () => controller.abort();
    }, [step, currentStudent]);

    // Design generation through the Nest backend (SPEC-029).
    useEffect(() => {
        if (step !== 'GENERATING_DESIGN' || !currentStudent) return;

        const controller = new AbortController();
        setError(null);
        setGenerationProgress({ status: MESSAGES.designGeneration.queued, progress: 10 });

        const occasion = designInput.occasion;
        const message = designInput.message.trim();
        const style = designInput.style;

        const run = async () => {
            if (!occasion || !message) {
                setError(MESSAGES.errors.generic);
                setStep('SELECT_DESIGN_OCCASION');
                return;
            }

            try {
                const job = await requestDesignGeneration({
                    occasion,
                    message,
                    style,
                    audience: 'child',
                    profileId: currentStudent.id,
                });
                const finalStatus = await followJob(job.jobId, {
                    signal: controller.signal,
                    onStatus: (status) => {
                        setGenerationProgress({
                            status:
                                status.status === 'completed'
                                    ? MESSAGES.designGeneration.completed
                                    : MESSAGES.designGeneration.processing,
                            progress:
                                status.progress ??
                                (status.status === 'queued' ? 15 : 60),
                        });
                    },
                });

                const designId = finalStatus.bookId ?? finalStatus.book?.id;

                if (finalStatus.status === 'failed' || !designId) {
                    throw new ApiError({
                        statusCode: 502,
                        code: finalStatus.error?.code ?? 'INTERNAL',
                        message:
                            finalStatus.error?.message ?? 'generation failed',
                    });
                }

                const detail = await getStudentDesign(designId);
                const story = designDetailToStory(detail, currentStudent.id);

                setConfig({
                    id: story.id,
                    protagonist: '',
                    scenery: '',
                    mission: '',
                    style: story.style,
                    title: story.title,
                    content: story.content ?? '',
                    imageUrl: story.image_url ?? undefined,
                    type: 'design',
                });
                setGenerationProgress({
                    status: MESSAGES.designGeneration.completed,
                    progress: 100,
                });
                speakWithState(t('wizard.designReady', { title: story.title }));
                setStep('STORY_DETAILS');
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }

                const failureMessage =
                    err instanceof ApiError
                        ? messageForErrorCode(err.code)
                        : err instanceof NetworkError
                          ? MESSAGES.errors.network
                          : MESSAGES.errors.generic;

                setGenerationProgress({
                    status: MESSAGES.designGeneration.failed,
                    progress: 0,
                });
                setError(failureMessage);
                speakWithState(failureMessage);
                // Never park the UI on the spinner: back to style selection.
                setStep('SELECT_DESIGN_STYLE');
            }
        };

        void run();

        return () => controller.abort();
    }, [step, currentStudent]);

    // Presentation generation through the Nest backend (SPEC-029B).
    useEffect(() => {
        if (step !== 'GENERATING_PRESENTATION' || !currentStudent) return;

        const controller = new AbortController();
        setError(null);
        setGenerationProgress({ status: MESSAGES.presentationGeneration.queued, progress: 10 });

        const topic = presentationInput.topic.trim();
        const style = presentationInput.style;
        const slideCount = presentationInput.slideCount;

        const run = async () => {
            if (!topic || slideCount === 0) {
                setError(MESSAGES.errors.generic);
                setStep('SELECT_PRESENTATION_TOPIC');
                return;
            }

            try {
                const job = await requestPresentationGeneration({
                    topic,
                    style,
                    slideCount,
                    audience: 'child',
                    profileId: currentStudent.id,
                });
                const finalStatus = await followJob(job.jobId, {
                    signal: controller.signal,
                    onStatus: (status) => {
                        setGenerationProgress({
                            status:
                                status.status === 'completed'
                                    ? MESSAGES.presentationGeneration.completed
                                    : MESSAGES.presentationGeneration.processing,
                            progress:
                                status.progress ??
                                (status.status === 'queued' ? 15 : 60),
                        });
                    },
                });

                const presentationId = finalStatus.bookId ?? finalStatus.book?.id;

                if (finalStatus.status === 'failed' || !presentationId) {
                    throw new ApiError({
                        statusCode: 502,
                        code: finalStatus.error?.code ?? 'INTERNAL',
                        message:
                            finalStatus.error?.message ?? 'generation failed',
                    });
                }

                const detail = await getStudentPresentation(presentationId);
                const story = presentationDetailToStory(detail, currentStudent.id);

                setConfig({
                    id: story.id,
                    protagonist: '',
                    scenery: '',
                    mission: '',
                    style: story.style,
                    title: story.title,
                    content: story.content ?? '',
                    imageUrl: story.image_url ?? undefined,
                    type: 'presentation',
                });
                setGenerationProgress({
                    status: MESSAGES.presentationGeneration.completed,
                    progress: 100,
                });
                speakWithState(t('wizard.presentationReady', { title: story.title }));
                setStep('STORY_DETAILS');
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }

                const failureMessage =
                    err instanceof ApiError
                        ? messageForErrorCode(err.code)
                        : err instanceof NetworkError
                          ? MESSAGES.errors.network
                          : MESSAGES.errors.generic;

                setGenerationProgress({
                    status: MESSAGES.presentationGeneration.failed,
                    progress: 0,
                });
                setError(failureMessage);
                speakWithState(failureMessage);
                // Never park the UI on the spinner: back to style selection.
                setStep('SELECT_PRESENTATION_STYLE');
            }
        };

        void run();

        return () => controller.abort();
    }, [step, currentStudent]);

    // Board generation through the Nest backend (SPEC-029C).
    useEffect(() => {
        if (step !== 'GENERATING_COMMUNICATION' || !currentStudent) return;

        const controller = new AbortController();
        setError(null);
        setGenerationProgress({ status: MESSAGES.communicationGeneration.queued, progress: 10 });

        const kind = communicationInput.kind;
        const topic = communicationInput.topic.trim();
        const style = communicationInput.style;
        const cellCount = communicationInput.cellCount;

        const run = async () => {
            if (!kind || !topic || cellCount === 0) {
                setError(MESSAGES.errors.generic);
                setStep('SELECT_COMMUNICATION_KIND');
                return;
            }

            try {
                const job = await requestCommunicationGeneration({
                    kind,
                    topic,
                    style,
                    cellCount,
                    audience: 'child',
                    profileId: currentStudent.id,
                });
                const finalStatus = await followJob(job.jobId, {
                    signal: controller.signal,
                    onStatus: (status) => {
                        setGenerationProgress({
                            status:
                                status.status === 'completed'
                                    ? MESSAGES.communicationGeneration.completed
                                    : MESSAGES.communicationGeneration.processing,
                            progress:
                                status.progress ??
                                (status.status === 'queued' ? 15 : 60),
                        });
                    },
                });

                const boardId = finalStatus.bookId ?? finalStatus.book?.id;

                if (finalStatus.status === 'failed' || !boardId) {
                    throw new ApiError({
                        statusCode: 502,
                        code: finalStatus.error?.code ?? 'INTERNAL',
                        message:
                            finalStatus.error?.message ?? 'generation failed',
                    });
                }

                const detail = await getStudentCommunication(boardId);
                setBoardDetail(detail);
                setLastSpokenCell('');
                setConfig({
                    id: detail.id,
                    protagonist: '',
                    scenery: '',
                    mission: '',
                    style: detail.style,
                    title: detail.title,
                    content: '',
                    imageUrl: undefined,
                    type: 'communication',
                });
                setGenerationProgress({
                    status: MESSAGES.communicationGeneration.completed,
                    progress: 100,
                });
                speakWithState(t('wizard.communicationReady', { title: detail.title }));
                setStep('BOARD_USE');
            } catch (err) {
                if (err instanceof DOMException && err.name === 'AbortError') {
                    return;
                }

                const failureMessage =
                    err instanceof ApiError
                        ? messageForErrorCode(err.code)
                        : err instanceof NetworkError
                          ? MESSAGES.errors.network
                          : MESSAGES.errors.generic;

                setGenerationProgress({
                    status: MESSAGES.communicationGeneration.failed,
                    progress: 0,
                });
                setError(failureMessage);
                speakWithState(failureMessage);
                // Never park the UI on the spinner: back to style selection.
                setStep('SELECT_COMMUNICATION_STYLE');
            }
        };

        void run();

        return () => controller.abort();
    }, [step, currentStudent]);
    if (isLoading) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
                <div className="text-center">
                    <span className="material-symbols-outlined text-6xl text-primary animate-spin">progress_activity</span>
                    <p className="mt-4 text-lg text-gray-400">Cargando...</p>
                </div>
            </div>
        );
    }

    // Vista de detalles del cuento (Previa a la lectura)
    if (step === 'STORY_DETAILS' && config.content) {
        // Reconstruct Story object from config
        const currentStory: any = {
            id: 'temp', // Not needed for display
            title: config.title || '',
            content: config.content,
            protagonist: config.protagonist,
            scenery: config.scenery,
            mission: config.mission,
            style: config.style,
            image_url: config.imageUrl || null,
            student_id: currentStudent?.id || '',
            type: config.type,
            dedication_to: config.dedication ?? null,
            dedication_reason: null,
            dedication_position: config.dedicationPosition ?? null,
            is_favorite: config.isFavorite ?? false
        };

        return (
            <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 to-slate-950">
                <StoryDetails
                    story={currentStory}
                    persisted={Boolean(config.id)}
                    onBack={() => {
                        setStep('LIBRARY');
                        speakWithState("Volviendo a la biblioteca");
                    }}
                    onRead={() => {
                        setStep('RESULT_VIEW');
                        speakWithState("Disfruta tu lectura");
                    }}
                    onGoMenu={() => {
                        setStep('MENU');
                        speakWithState("Menú principal");
                    }}
                    voiceEnabled={voiceEnabled}
                />
            </div>
        );
    }



    // Vista de lectura del cuento
    if (step === 'RESULT_VIEW' && config.content) {
        return (
            <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 to-slate-950">
                <StoryReader
                    title={config.title || `Las Aventuras de ${config.protagonist}`}
                    content={config.content}
                    protagonist={config.protagonist}
                    scenery={config.scenery}
                    mission={config.mission}
                    style={config.style}
                    studentId={currentStudent?.id}
                    // Tableros y diseños/presentaciones are already persisted
                    // server-side: keep the legacy auto-save off and skip
                    // book-only mutations.
                    persisted={config.type === 'design' || config.type === 'presentation' || config.type === 'communication' ? true : Boolean(config.id)}
                    bookId={config.type === 'design' || config.type === 'presentation' || config.type === 'communication' ? undefined : config.id}
                    dedication={config.dedication}
                    dedicationPosition={config.dedicationPosition}
                    isFavorite={config.isFavorite}
                    onDedicationChange={(entry) =>
                        setConfig((prev) => ({
                            ...prev,
                            dedication: entry?.text || undefined,
                            dedicationPosition: entry?.position,
                        }))
                    }
                    onFavoriteChange={(isFavorite) =>
                        setConfig((prev) => ({ ...prev, isFavorite }))
                    }
                    initialScrollTop={initialScrollTop}
                    onScrollProgress={handleViewerScroll}
                    onClose={() => setStep('STORY_DETAILS')}
                    onRead={speakWithState}
                    onCreateAnother={handleCreateAnother}
                    scanInterval={scanInterval}
                    voiceEnabled={voiceEnabled}
                />
                <FloatingControls onGoToMenu={handleBackToMenu} />

                {/* Pause Overlay */}
                {isPaused && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex flex-col items-center justify-center print:hidden">
                        <span className="material-symbols-outlined text-9xl text-amber-400 animate-pulse">
                            pause_circle
                        </span>
                        <h2 className="text-3xl font-bold mt-6 text-white">En Pausa</h2>
                        <p className="text-gray-400 mt-2">Toma un descanso</p>
                        <p className="text-gray-400 text-sm mt-6">
                            Presiona el botón flotante para continuar
                        </p>
                    </div>
                )}
            </div>
        );
    }

    // Vista de biblioteca del estudiante
    if (step === 'LIBRARY' && currentStudent) {
        const handleSelectStory = (story: Story) => {
            if (story.type === 'communication') {
                // Boards open in the use view: fetch cells, then speak.
                const openBoard = async () => {
                    try {
                        const detail = await getStudentCommunication(story.id);
                        setBoardDetail(detail);
                        setLastSpokenCell('');
                        setStep('BOARD_USE');
                        speakWithState(`Has seleccionado ${detail.title}`);
                    } catch {
                        setError(MESSAGES.errors.libraryUnavailable);
                    }
                };
                void openBoard();
                return;
            }
            // Load story into config and show it
            setConfig({
                id: story.id,
                protagonist: story.protagonist,
                scenery: story.scenery,
                mission: story.mission,
                style: story.style,
                title: story.title,
                content: story.content || '',
                imageUrl: story.image_url || undefined,
                type: (story.type as 'story' | 'design' | 'presentation' | 'communication') || 'story',
                dedication: story.dedication_to ?? undefined,
                dedicationPosition:
                    (story.dedication_position as 'start' | 'end') ??
                    undefined,
                isFavorite: story.is_favorite ?? false,
            });
            setStep('STORY_DETAILS');
            speakWithState(`Has seleccionado ${story.title}`);
        };

        return (
            <div className="min-h-[100dvh] flex flex-col bg-gradient-to-br from-slate-900 to-slate-950 text-white font-display">
                {/* Header */}
                <header className="flex items-center justify-between px-4 md:px-8 py-3 bg-black/30 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-primary/20 text-primary flex items-center justify-center rounded-xl">
                            <span className="material-symbols-outlined text-2xl">rocket</span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tighter">FUTURAR</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-full border border-white/10">
                            <span className="material-symbols-outlined text-primary">{currentStudent.avatar_icon || 'person'}</span>
                            <span className="text-sm font-bold uppercase tracking-wide hidden md:block">{currentStudent.name}</span>
                        </div>
                        <button
                            onClick={handleBackToMenu}
                            className="p-2 min-w-11 min-h-11 hover:bg-white/10 rounded-full transition-colors bg-white/5"
                            title="Menú Principal"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                    </div>
                </header>

                {/* Library Content */}
                <main className="flex-1 flex flex-col items-center safe-center p-4 md:p-6 lg:p-8 overflow-y-auto">
                    <StudentLibrary
                        studentId={currentStudent.id}
                        studentName={currentStudent.name}
                        scanInterval={scanInterval}
                        voiceEnabled={voiceEnabled}
                        soundEnabled={soundEnabled}
                        isPaused={scanningPaused}
                        onSelectStory={handleSelectStory}
                        onBack={handleBackToMenu}
                    />
                </main>

                <FloatingControls onGoToMenu={handleBackToMenu} />

                {/* Pause Overlay */}
                {isPaused && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex flex-col items-center justify-center print:hidden">
                        <span className="material-symbols-outlined text-9xl text-amber-400 animate-pulse">
                            pause_circle
                        </span>
                        <h2 className="text-3xl font-bold mt-6 text-white">En Pausa</h2>
                        <p className="text-gray-400 mt-2">Toma un descanso</p>
                        <p className="text-gray-400 text-sm mt-6">
                            Presiona el botón flotante para continuar
                        </p>
                    </div>
                )}
            </div>
        );
    }


    // Vista de uso del tablero (SPEC-029C): celdas grandes, elegir habla.
    if (step === 'BOARD_USE' && currentStudent && boardDetail) {
        const cellOptions: ScanOption[] = boardDetail.cells.map((cell, index) => ({
            id: String(index),
            label: cell.label,
            icon: 'forum',
            image: cell.imageUrl ?? undefined,
        }));

        return (
            <div className="min-h-[100dvh] flex flex-col bg-gradient-to-br from-slate-900 to-slate-950 text-white font-display">
                <header className="flex items-center justify-between px-4 md:px-8 py-3 bg-black/30 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-primary/20 text-primary flex items-center justify-center rounded-xl">
                            <span className="material-symbols-outlined text-2xl">forum</span>
                        </div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tighter">{boardDetail.title}</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleBackToLibrary}
                            className="p-2 min-w-11 min-h-11 hover:bg-white/10 rounded-full transition-colors bg-white/5"
                            title="Volver a la biblioteca"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                    </div>
                </header>

                <main className="flex-1 flex flex-col items-center safe-center p-4 md:p-6 lg:p-8 overflow-y-auto">
                    <p aria-live="polite" className="text-lg md:text-xl font-bold text-gray-200 mb-6 min-h-8">
                        {lastSpokenCell || boardDetail.topic}
                    </p>
                    <div className="w-full max-w-5xl text-center">
                        <ScanningGrid
                            options={cellOptions}
                            onSelect={handleBoardCellSelect}
                            columns={Math.min(3, scanColumns + 1)}
                            scanInterval={scanInterval}
                            soundEnabled={soundEnabled}
                            voiceEnabled={voiceEnabled}
                            isPaused={scanningPaused}
                        />
                    </div>
                </main>

                <FloatingControls onGoToMenu={handleBackToMenu} />
            </div>
        );
    }


    return (
        <div className="min-h-[100dvh] flex flex-col bg-gradient-to-br from-slate-900 to-slate-950 text-white font-display">
            {/* Header Compacto */}
            <header className="flex items-center justify-between px-4 md:px-8 py-3 bg-black/30 border-b border-white/10 print:hidden">
                <div className="flex items-center gap-3">
                    <div className="size-10 bg-primary/20 text-primary flex items-center justify-center rounded-xl">
                        <span className="material-symbols-outlined text-2xl">rocket</span>
                    </div>
                    <h1 className="text-xl md:text-2xl font-black tracking-tighter">FUTURAR</h1>
                </div>

                <div className="flex items-center gap-2">
                    {currentStudent && (
                        <>
                            <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-full border border-white/10">
                                <span className="material-symbols-outlined text-primary">{currentStudent.avatar_icon || 'person'}</span>
                                <span className="text-sm font-bold uppercase tracking-wide hidden md:block">{currentStudent.name}</span>
                            </div>

                            {step !== 'MENU' && step !== 'PROFILE' && (
                                <button
                                    onClick={handleBackToMenu}
                                    className="p-2 min-w-11 min-h-11 hover:bg-white/10 rounded-full transition-colors bg-white/5"
                                    title="Menú Principal"
                                >
                                    <span className="material-symbols-outlined">home</span>
                                </button>
                            )}

                            <button
                                onClick={handleBackToProfile}
                                className="p-2 min-w-11 min-h-11 hover:bg-white/10 rounded-full transition-colors text-red-400 hover:text-red-300"
                                title="Salir"
                            >
                                <span className="material-symbols-outlined">logout</span>
                            </button>
                        </>
                    )}

                    {!currentStudent && step === 'PROFILE' && (
                        <button
                            onClick={onSwitchToTeacher}
                            className="ml-4 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">settings</span>
                            Panel Docente
                        </button>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center safe-center p-4 md:p-6 lg:p-8 overflow-y-auto">

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-300 flex items-center gap-3">
                        <span className="material-symbols-outlined">error</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* Profile Selection */}
                {step === 'PROFILE' && (
                    <div className="w-full max-w-4xl text-center">
                        <h2 className="text-3xl md:text-5xl font-black mb-8 animate-fade-in">
                            ¿Quién eres?
                        </h2>
                        {profileOptions.length > 0 ? (
                            <ScanningGrid
                                options={profileOptions}
                                onSelect={handleProfileSelect}
                                columns={Math.min(scanColumns, profileOptions.length)}
                                scanInterval={scanInterval}
                                soundEnabled={true}
                                voiceEnabled={voiceEnabled}
                                isPaused={scanningPaused}
                            />
                        ) : (
                            <div className="text-center py-16">
                                <span className="material-symbols-outlined text-6xl text-gray-600 mb-4">person_off</span>
                                <p className="text-xl text-gray-400">No hay estudiantes registrados</p>
                                <p className="text-gray-400 mt-2">Agrega estudiantes desde el Panel Docente</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Menu and Selection Steps (029C lesson: every new wizard step must be listed here) */}
                {['MENU', 'SELECT_PROTAGONIST', 'SELECT_SCENERY', 'SELECT_MISSION', 'SELECT_STYLE', 'SELECT_DESIGN_OCCASION', 'SELECT_DESIGN_MESSAGE', 'SELECT_DESIGN_STYLE', 'SELECT_PRESENTATION_TOPIC', 'SELECT_PRESENTATION_SLIDE_COUNT', 'SELECT_PRESENTATION_STYLE', 'SELECT_COMMUNICATION_KIND', 'SELECT_COMMUNICATION_TOPIC', 'SELECT_COMMUNICATION_CELL_COUNT', 'SELECT_COMMUNICATION_STYLE'].includes(step) && (
                    <div className="w-full max-w-5xl text-center">
                        {/* Progress Indicator (book wizard only) */}
                        {step !== 'MENU' && !step.startsWith('SELECT_DESIGN') && !step.startsWith('SELECT_PRESENTATION') && !step.startsWith('SELECT_COMMUNICATION') && (
                            <div className="mb-6 flex items-center justify-center gap-2">
                                <div className={`h-2 w-16 rounded-full transition-all ${step === 'SELECT_PROTAGONIST' || step === 'SELECT_SCENERY' || step === 'SELECT_MISSION' || step === 'SELECT_STYLE' ? 'bg-primary' : 'bg-slate-700'}`} />
                                <div className={`h-2 w-16 rounded-full transition-all ${step === 'SELECT_SCENERY' || step === 'SELECT_MISSION' || step === 'SELECT_STYLE' ? 'bg-primary' : 'bg-slate-700'}`} />
                                <div className={`h-2 w-16 rounded-full transition-all ${step === 'SELECT_MISSION' || step === 'SELECT_STYLE' ? 'bg-primary' : 'bg-slate-700'}`} />
                                <div className={`h-2 w-16 rounded-full transition-all ${step === 'SELECT_STYLE' ? 'bg-primary' : 'bg-slate-700'}`} />
                            </div>
                        )}

                        {/* Current Selections */}
                        {step !== 'MENU' && (config.protagonist || config.scenery || config.mission) && (
                            <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
                                {config.protagonist && (
                                    <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-bold">
                                        {config.protagonist}
                                    </span>
                                )}
                                {config.scenery && (
                                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-bold">
                                        {config.scenery}
                                    </span>
                                )}
                                {config.mission && (
                                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-bold">
                                        {config.mission}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Current design selections */}
                        {step.startsWith('SELECT_DESIGN') && (designInput.occasionLabel || designInput.style) && (
                            <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
                                {designInput.occasionLabel && (
                                    <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-bold">
                                        {designInput.occasionLabel}
                                    </span>
                                )}
                                {designInput.style && (
                                        <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-bold">
                                            {designInput.style}
                                        </span>
                                    )}
                            </div>
                        )}

                        {/* Current presentation selections */}
                        {step.startsWith('SELECT_PRESENTATION') && (presentationInput.topic || presentationInput.slideCountLabel || presentationInput.style) && (
                            <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
                                {presentationInput.topic && (
                                    <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-bold">
                                        {presentationInput.topic}
                                    </span>
                                )}
                                {presentationInput.slideCountLabel && (
                                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-bold">
                                        {presentationInput.slideCountLabel}
                                    </span>
                                )}
                                {presentationInput.style && (
                                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-bold">
                                        {presentationInput.style}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Current board selections */}
                        {step.startsWith('SELECT_COMMUNICATION') && (communicationInput.kindLabel || communicationInput.topic || communicationInput.cellCountLabel || communicationInput.style) && (
                            <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
                                {communicationInput.kindLabel && (
                                    <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-bold">
                                        {communicationInput.kindLabel}
                                    </span>
                                )}
                                {communicationInput.topic && (
                                    <span className="px-3 py-1 bg-teal-500/20 text-teal-300 rounded-full text-sm font-bold">
                                        {communicationInput.topic}
                                    </span>
                                )}
                                {communicationInput.cellCountLabel && (
                                    <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-bold">
                                        {communicationInput.cellCountLabel}
                                    </span>
                                )}
                                {communicationInput.style && (
                                    <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-bold">
                                        {communicationInput.style}
                                    </span>
                                )}
                            </div>
                        )}

                        <h2 className="text-2xl md:text-4xl font-black mb-8 animate-fade-in">
                            {step === 'MENU' && t('wizard.menuTitle')}
                            {step === 'SELECT_PROTAGONIST' && t('wizard.protagonistTitle')}
                            {step === 'SELECT_SCENERY' && t('wizard.sceneryTitle')}
                            {step === 'SELECT_MISSION' && t('wizard.missionTitle')}
                            {step === 'SELECT_STYLE' && t('wizard.styleTitle')}
                            {step === 'SELECT_DESIGN_OCCASION' && t('wizard.designOccasionTitle')}
                            {step === 'SELECT_DESIGN_MESSAGE' && t('wizard.designMessageTitle')}
                            {step === 'SELECT_DESIGN_STYLE' && t('wizard.designStyleTitle')}
                            {step === 'SELECT_PRESENTATION_TOPIC' && t('wizard.presentationTopicTitle')}
                            {step === 'SELECT_PRESENTATION_SLIDE_COUNT' && t('wizard.presentationSlideCountTitle')}
                            {step === 'SELECT_PRESENTATION_STYLE' && t('wizard.presentationStyleTitle')}
                            {step === 'SELECT_COMMUNICATION_KIND' && t('wizard.communicationKindTitle')}
                            {step === 'SELECT_COMMUNICATION_TOPIC' && t('wizard.communicationTopicTitle')}
                            {step === 'SELECT_COMMUNICATION_CELL_COUNT' && t('wizard.communicationCellCountTitle')}
                            {step === 'SELECT_COMMUNICATION_STYLE' && t('wizard.communicationStyleTitle')}
                        </h2>

                        {pageCount > 1 && step !== 'SELECT_DESIGN_MESSAGE' && step !== 'SELECT_PRESENTATION_TOPIC' && step !== 'SELECT_COMMUNICATION_TOPIC' && (
                            <p aria-live="polite" className="text-sm md:text-base font-bold text-gray-300 mb-4">
                                {t('wizard.pageIndicator', { current: safePage + 1, total: pageCount })}
                            </p>
                        )}

                        {step === 'SELECT_COMMUNICATION_TOPIC' ? (
                            <form
                                className="max-w-xl mx-auto flex flex-col gap-4 text-left"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    handleCommunicationTopicNext();
                                }}
                            >
                                <label
                                    htmlFor="communication-topic"
                                    className="text-base md:text-lg font-bold text-gray-200"
                                >
                                    {t('wizard.communicationTopicLabel')}
                                </label>
                                <textarea
                                    id="communication-topic"
                                    value={communicationInput.topic}
                                    maxLength={COMMUNICATION_TOPIC_MAX_LENGTH}
                                    rows={3}
                                    placeholder={t('wizard.communicationTopicPlaceholder')}
                                    onChange={(event) =>
                                        setCommunicationInput((prev) => ({
                                            ...prev,
                                            topic: event.target.value,
                                        }))
                                    }
                                    className="w-full min-h-11 p-4 text-lg rounded-2xl bg-slate-800/80 border-2 border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none"
                                />
                                <p className="text-sm text-gray-400">
                                    {t('wizard.communicationTopicHint')}
                                </p>
                                <p aria-live="polite" className="text-sm font-bold text-gray-300">
                                    {t('wizard.communicationTopicCount', {
                                        current: communicationInput.topic.length,
                                        total: COMMUNICATION_TOPIC_MAX_LENGTH,
                                    })}
                                </p>
                                <button
                                    type="submit"
                                    disabled={!communicationInput.topic.trim()}
                                    className="px-8 py-4 min-h-11 rounded-2xl font-bold text-lg bg-primary hover:bg-primary/80 transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                                >
                                    {t('wizard.communicationTopicNext')}
                                </button>
                            </form>
                        ) : step === 'SELECT_PRESENTATION_TOPIC' ? (
                            <form
                                className="max-w-xl mx-auto flex flex-col gap-4 text-left"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    handlePresentationTopicNext();
                                }}
                            >
                                <label
                                    htmlFor="presentation-topic"
                                    className="text-base md:text-lg font-bold text-gray-200"
                                >
                                    {t('wizard.presentationTopicLabel')}
                                </label>
                                <textarea
                                    id="presentation-topic"
                                    value={presentationInput.topic}
                                    maxLength={PRESENTATION_TOPIC_MAX_LENGTH}
                                    rows={3}
                                    placeholder={t('wizard.presentationTopicPlaceholder')}
                                    onChange={(event) =>
                                        setPresentationInput((prev) => ({
                                            ...prev,
                                            topic: event.target.value,
                                        }))
                                    }
                                    className="w-full min-h-11 p-4 text-lg rounded-2xl bg-slate-800/80 border-2 border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none"
                                />
                                <p className="text-sm text-gray-400">
                                    {t('wizard.presentationTopicHint')}
                                </p>
                                <p aria-live="polite" className="text-sm font-bold text-gray-300">
                                    {t('wizard.presentationTopicCount', {
                                        current: presentationInput.topic.length,
                                        total: PRESENTATION_TOPIC_MAX_LENGTH,
                                    })}
                                </p>
                                <button
                                    type="submit"
                                    disabled={!presentationInput.topic.trim()}
                                    className="px-8 py-4 min-h-11 rounded-2xl font-bold text-lg bg-primary hover:bg-primary/80 transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                                >
                                    {t('wizard.presentationTopicNext')}
                                </button>
                            </form>
                        ) : step === 'SELECT_DESIGN_MESSAGE' ? (
                            <form
                                className="max-w-xl mx-auto flex flex-col gap-4 text-left"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    handleDesignMessageNext();
                                }}
                            >
                                <label
                                    htmlFor="design-message"
                                    className="text-base md:text-lg font-bold text-gray-200"
                                >
                                    {t('wizard.designMessageLabel')}
                                </label>
                                <textarea
                                    id="design-message"
                                    value={designInput.message}
                                    maxLength={DESIGN_MESSAGE_MAX_LENGTH}
                                    rows={3}
                                    placeholder={t('wizard.designMessagePlaceholder')}
                                    onChange={(event) =>
                                        setDesignInput((prev) => ({
                                            ...prev,
                                            message: event.target.value,
                                        }))
                                    }
                                    className="w-full min-h-11 p-4 text-lg rounded-2xl bg-slate-800/80 border-2 border-white/10 text-white placeholder:text-gray-500 focus:border-primary focus:outline-none"
                                />
                                <p className="text-sm text-gray-400">
                                    {t('wizard.designMessageHint')}
                                </p>
                                <p aria-live="polite" className="text-sm font-bold text-gray-300">
                                    {t('wizard.designMessageCount', {
                                        current: designInput.message.length,
                                        total: DESIGN_MESSAGE_MAX_LENGTH,
                                    })}
                                </p>
                                <button
                                    type="submit"
                                    disabled={!designInput.message.trim()}
                                    className="px-8 py-4 min-h-11 rounded-2xl font-bold text-lg bg-primary hover:bg-primary/80 transition-all hover:scale-105 disabled:opacity-40 disabled:hover:scale-100"
                                >
                                    {t('wizard.designMessageNext')}
                                </button>
                            </form>
                        ) : (
                            <ScanningGrid
                                options={pageOptions}
                                onSelect={handleWizardSelect}
                                columns={step === 'MENU' ? 2 : Math.min(3, scanColumns + 1)}
                                scanInterval={scanInterval}
                                soundEnabled={soundEnabled}
                                voiceEnabled={voiceEnabled}
                                isPaused={scanningPaused}
                            />
                        )}
                    </div>
                )}

                {/* Fallback for missing content in Result/Details view */}
                {((step === 'RESULT_VIEW' || step === 'STORY_DETAILS') && !config.content) && (
                    <div className="flex flex-col items-center justify-center text-center max-w-lg">
                        <span className="material-symbols-outlined text-6xl text-red-400 mb-4 animate-bounce">error_outline</span>
                        <h3 className="text-2xl font-bold text-white mb-2">Error al cargar el contenido</h3>
                        <p className="text-gray-400 mb-6">No se pudo recuperar la historia.</p>
                        <button
                            onClick={handleBackToMenu}
                            className="bg-primary hover:bg-primary/80 text-white font-bold py-3 px-8 rounded-full transition-all"
                        >
                            {t('wizard.backToMenu')}
                        </button>
                    </div>
                )}

                {/* Generating State */}
                {(step === 'GENERATING' || step === 'GENERATING_DESIGN' || step === 'GENERATING_PRESENTATION' || step === 'GENERATING_COMMUNICATION') && (
                    <div className="flex flex-col items-center text-center max-w-lg">
                        <div className="relative mb-8">
                            <span className="material-symbols-outlined text-8xl text-primary animate-pulse">auto_fix</span>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>

                        <h2 className="text-3xl md:text-4xl font-black mb-4">
                            {step === 'GENERATING_DESIGN'
                                ? t('wizard.generatingDesignTitle')
                                : step === 'GENERATING_PRESENTATION'
                                  ? t('wizard.generatingPresentationTitle')
                                  : step === 'GENERATING_COMMUNICATION'
                                    ? t('wizard.generatingCommunicationTitle')
                                    : t('wizard.generatingTitle')}
                        </h2>

                        <p className="text-lg text-gray-400 mb-6">
                            {generationProgress.status || 'La IA está escribiendo tu aventura única'}
                        </p>

                        {/* Progress Bar */}
                        <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-blue-500 transition-all duration-500 ease-out rounded-full"
                                style={{ width: `${generationProgress.progress}%` }}
                            />
                        </div>

                        {error && (
                            <div
                                role="alert"
                                className="mt-6 w-full p-4 bg-red-500/10 border border-red-500/40 rounded-2xl text-left"
                            >
                                <p className="text-red-300 font-medium">{error}</p>
                                <button
                                    onClick={() =>
                                        setStep(
                                            step === 'GENERATING_DESIGN'
                                                ? 'SELECT_DESIGN_STYLE'
                                                : step === 'GENERATING_PRESENTATION'
                                                  ? 'SELECT_PRESENTATION_STYLE'
                                                  : step === 'GENERATING_COMMUNICATION'
                                                    ? 'SELECT_COMMUNICATION_STYLE'
                                                    : 'SELECT_STYLE',
                                        )
                                    }
                                    className="mt-4 px-6 py-3 min-h-11 bg-primary rounded-xl font-bold hover:bg-primary/80 transition-colors"
                                >
                                    {t('wizard.retry')}
                                </button>
                            </div>
                        )}

                        {/* Story Preview */}
                        {step === 'GENERATING_DESIGN' ? (
                            <div className="mt-8 p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                                <p className="text-sm text-gray-400">
                                    {t('wizard.designPreview', {
                                        occasion: designInput.occasionLabel,
                                        style: designInput.style,
                                    })}
                                </p>
                            </div>
                        ) : step === 'GENERATING_PRESENTATION' ? (
                            <div className="mt-8 p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                                <p className="text-sm text-gray-400">
                                    {t('wizard.presentationPreview', {
                                        topic: presentationInput.topic,
                                        slideCount: presentationInput.slideCount,
                                        style: presentationInput.style,
                                    })}
                                </p>
                            </div>
                        ) : step === 'GENERATING_COMMUNICATION' ? (
                            <div className="mt-8 p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                                <p className="text-sm text-gray-400">
                                    {t('wizard.communicationPreview', {
                                        kind: communicationInput.kindLabel,
                                        topic: communicationInput.topic,
                                        cellCount: communicationInput.cellCount,
                                        style: communicationInput.style,
                                    })}
                                </p>
                            </div>
                        ) : (
                            <div className="mt-8 p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
                                <p className="text-sm text-gray-400">
                                    Protagonista: <span className="text-primary font-bold">{config.protagonist}</span> •
                                    Escenario: <span className="text-blue-400 font-bold">{config.scenery}</span> •
                                    Misión: <span className="text-green-400 font-bold">{config.mission}</span>
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="w-full border-t border-white/10 bg-black/30 py-3 px-4 print:hidden">
                <div className="max-w-5xl mx-auto flex items-center justify-between text-gray-400">
                    <div className="flex items-center gap-2">
                        {isSpeaking && <span className="material-symbols-outlined animate-pulse text-green-400">volume_up</span>}
                        <span className="text-xs font-bold uppercase tracking-wider">
                            {isSpeaking ? 'Leyendo...' : 'Listo'}
                        </span>
                    </div>
                    <span className="text-xs">Presiona <kbd className="px-2 py-1 bg-slate-800 rounded text-xs">Espacio</kbd> o <kbd className="px-2 py-1 bg-slate-800 rounded text-xs">Enter</kbd> para seleccionar</span>
                    <span className="text-xs opacity-50">© 2026 Futurar</span>
                </div>
            </footer>

            {/* Pause Overlay - blocks all interaction when paused */}
            {isPaused && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex flex-col items-center justify-center print:hidden">
                    <span className="material-symbols-outlined text-9xl text-amber-400 animate-pulse">
                        pause_circle
                    </span>
                    <h2 className="text-3xl font-bold mt-6 text-white">En Pausa</h2>
                    <p className="text-gray-400 mt-2">Toma un descanso</p>
                    <p className="text-gray-400 text-sm mt-6">
                        Presiona el botón flotante para continuar
                    </p>
                </div>
            )}

            {/* Floating Controls - visible when student is selected */}
            {currentStudent && step !== 'GENERATING' && step !== 'GENERATING_DESIGN' && (
                <FloatingControls onGoToMenu={handleBackToMenu} />
            )}
        </div>
    );
};

// Wrapper component that provides the context
const StudentApp: React.FC<StudentAppProps> = (props) => {
    return (
        <ScanSettingsProvider>
            <StudentAppInner {...props} />
        </ScanSettingsProvider>
    );
};

export default StudentApp;
