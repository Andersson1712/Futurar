import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import ScanningGrid from './ScanningGrid';
import StoryReader from './StoryReader';
import StoryDetails from './StoryDetails';
import StudentLibrary from './StudentLibrary';
import GeneratingView from './GeneratingView';
import FloatingControls from './FloatingControls';
import { generateStoryContent, generateStoryImage } from '../services/ai';
import { ScanSettingsProvider, useScanSettings } from '../contexts/ScanSettingsContext';
import { speak, stopSpeaking } from '../utils/speech';
import { getRandomImage } from '../utils/images';
import type { Student, StudentSettings, Story } from '../types/database';
import type { ScanOption } from '../types';

// Tipos locales
interface StoryConfig {
    protagonist: string;
    scenery: string;
    mission: string;
    style: string;
    title?: string;
    content?: string;
    imageUrl?: string;
    type: 'story' | 'design';
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
    | 'RESULT_VIEW'
    | 'STORY_DETAILS';

interface StudentWithSettings extends Student {
    student_settings: StudentSettings | null;
}

interface StudentAppProps {
    onSwitchToTeacher: () => void;
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
    const [reloadStudents, setReloadStudents] = useState(0);

    // Get ONLY pause state from context (for FloatingControls)
    // DO NOT sync student settings to context - this causes infinite render loops
    const { isPaused } = useScanSettings();

    // Compute effective settings directly from student (no context sync needed)
    const scanInterval = currentStudent?.student_settings?.scan_interval || 3000;
    const voiceEnabled = currentStudent?.student_settings?.voice_feedback ?? true;
    const soundEnabled = currentStudent?.student_settings?.sound_enabled ?? true;
    const scanColumns = currentStudent?.student_settings?.scan_columns || 2;

    // Cargar estudiantes al montar y cuando se solicita recarga
    useEffect(() => {
        const loadStudents = async () => {
            try {
                const { data, error: dbError } = await supabase
                    .from('students')
                    .select(`*, student_settings(*)`)
                    .eq('is_active', true)
                    .order('name');

                if (dbError) throw dbError;

                const processedData = (data || []).map(s => ({
                    ...s,
                    student_settings: Array.isArray(s.student_settings) && s.student_settings.length > 0
                        ? s.student_settings[0]
                        : (s.student_settings as unknown as StudentSettings | null)
                })) as StudentWithSettings[];

                setStudents(processedData);
            } catch (err: any) {
                console.error('Error cargando estudiantes:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        loadStudents();
    }, [reloadStudents]);

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
        { id: 'story', label: 'Crear Cuento', icon: 'auto_stories' },
        { id: 'library', label: 'Mi Biblioteca', icon: 'collections_bookmark' },
        { id: 'design', label: 'Diseñar', icon: 'brush' }
    ];

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
                const [protRes, scenRes, missRes, styleRes] = await Promise.all([
                    supabase.from('student_protagonists').select('*').eq('student_id', currentStudent.id).eq('is_enabled', true),
                    supabase.from('student_scenarios').select('*').eq('student_id', currentStudent.id).eq('is_enabled', true),
                    supabase.from('student_missions').select('*').eq('student_id', currentStudent.id).eq('is_enabled', true),
                    supabase.from('student_styles').select('*').eq('student_id', currentStudent.id).eq('is_enabled', true)
                ]);

                setStudentProtagonists((protRes.data || []).map(p => ({ id: p.id, label: p.label, icon: p.icon })));
                setStudentScenarios((scenRes.data || []).map(s => ({ id: s.id, label: s.label, icon: s.icon })));
                setStudentMissions((missRes.data || []).map(m => ({ id: m.id, label: m.label, icon: m.icon })));
                setStudentStyles((styleRes.data || []).map(st => ({ id: st.id, label: st.label, icon: st.icon })));
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
        setConfig(prev => ({ ...prev, type: opt.id as 'story' | 'design' }));
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

    const handleBackToProfile = () => {
        console.log('🚪 handleBackToProfile called - setting step to PROFILE');
        handleStopSpeaking();
        setStep('PROFILE');
        setCurrentStudent(null);
        setConfig({ protagonist: '', scenery: '', mission: '', style: '', type: 'story' });
        setElementsLoaded(false);
        setStudentProtagonists([]);
        setStudentScenarios([]);
        setStudentMissions([]);
        setStudentStyles([]);
        setReloadStudents(prev => prev + 1);
    };

    const handleBackToMenu = () => {
        handleStopSpeaking();
        setStep('MENU');
        setConfig({ protagonist: '', scenery: '', mission: '', style: '', type: 'story' });
    };

    const handleCreateAnother = () => {
        handleStopSpeaking();
        setStep('SELECT_PROTAGONIST');
        setConfig(prev => ({ ...prev, protagonist: '', scenery: '', mission: '', style: '', content: '', title: '' }));
    };

    // Generar historia con IA
    useEffect(() => {
        if (step === 'GENERATING') {
            const doGenerate = async () => {
                setGenerationProgress({ status: 'Iniciando...', progress: 10 });

                try {
                    console.log('🚀 Iniciando generación de cuento con IA...');
                    setGenerationProgress({ status: 'Conectando con la IA...', progress: 20 });

                    const [genContent, genImageUrl] = await Promise.all([
                        generateStoryContent(
                            config.protagonist,
                            config.scenery,
                            config.mission,
                            config.style,
                            currentStudent?.student_settings?.story_length || 'medium',
                            currentStudent?.student_settings?.target_audience || 'child'
                        ),
                        generateStoryImage(
                            `Portada de cuento infantil. Protagonista: ${config.protagonist}. Escenario: ${config.scenery}. Estilo: ${config.style}. Sin texto.`,
                            config.style
                        )
                    ]);

                    setGenerationProgress({ status: 'Procesando el cuento...', progress: 80 });

                    if (genContent && genContent.length > 100) {
                        // Extract title from first line
                        const lines = genContent.split('\n');
                        let title = lines[0].trim();
                        let contentBody = genContent;

                        // Basic validation to ensure first line is actually a title
                        if (title.length < 100 && !title.includes('CAPÍTULO')) {
                            contentBody = lines.slice(1).join('\n').trim();
                        } else {
                            title = `Las Aventuras de ${config.protagonist}`;
                        }

                        // Remove quotes if present
                        title = title.replace(/^["']|["']$/g, '');

                        setConfig(prev => ({ ...prev, title, content: contentBody, imageUrl: genImageUrl }));
                        setGenerationProgress({ status: '¡Cuento listo!', progress: 100 });

                        setTimeout(() => {
                            setStep('STORY_DETAILS');
                            speakWithState("¡Tu cuento está listo! Mira los detalles antes de leerlo.");
                        }, 500);
                    } else {
                        throw new Error('El contenido generado es muy corto');
                    }

                } catch (e: any) {
                    console.error("❌ Error generando historia:", e);
                    setError(`Error al generar: ${e.message}`);
                    setGenerationProgress({ status: 'Error...', progress: 0 });

                    // setTimeout(() => {
                    //     setStep('MENU');
                    //     setError(null);
                    // }, 3000);
                }
            };

            doGenerate();
        }
    }, [step]);

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
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
            type: config.type
        };

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950">
                <StoryDetails
                    story={currentStory}
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
                    scanInterval={scanInterval}
                    soundEnabled={soundEnabled}
                />
            </div>
        );
    }



    // Vista de lectura del cuento
    if (step === 'RESULT_VIEW' && config.content) {
        return (
            <StoryReader
                title={config.title || `Las Aventuras de ${config.protagonist}`}
                content={config.content}
                protagonist={config.protagonist}
                scenery={config.scenery}
                style={config.style}
                onClose={() => {
                    handleStopSpeaking();
                    setStep('STORY_DETAILS');
                }}
                onExit={() => {
                    handleStopSpeaking();
                    handleBackToProfile();
                }}
                onGoMenu={() => {
                    handleStopSpeaking();
                    handleBackToMenu();
                }}
                scanInterval={scanInterval}
                voiceEnabled={voiceEnabled}
                soundEnabled={soundEnabled}
            />
        );
    }

    // Vista de biblioteca del estudiante
    if (step === 'LIBRARY' && currentStudent) {
        const handleSelectStory = (story: Story) => {
            // Load story into config and show it
            setConfig({
                protagonist: story.protagonist,
                scenery: story.scenery,
                mission: story.mission,
                style: story.style,
                title: story.title,
                content: story.content || '',
                imageUrl: story.image_url || undefined,
                type: (story.type as 'story' | 'design') || 'story',
            });
            setStep('STORY_DETAILS');
            speakWithState(`Has seleccionado ${story.title}`);
        };

        return (
            <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 to-slate-950 text-white font-display">
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
                            className="p-2 hover:bg-white/10 rounded-full transition-colors bg-white/5"
                            title="Menú Principal"
                        >
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                    </div>
                </header>

                {/* Library Content */}
                <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-8 overflow-hidden">
                    <StudentLibrary
                        studentId={currentStudent.id}
                        studentName={currentStudent.name}
                        scanInterval={scanInterval}
                        voiceEnabled={voiceEnabled}
                        soundEnabled={soundEnabled}
                        isPaused={isPaused}
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
                        <p className="text-gray-500 text-sm mt-6">
                            Presiona el botón flotante para continuar
                        </p>
                    </div>
                )}
            </div>
        );
    }


    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 to-slate-950 text-white font-display">
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
                                    className="p-2 hover:bg-white/10 rounded-full transition-colors bg-white/5"
                                    title="Menú Principal"
                                >
                                    <span className="material-symbols-outlined">home</span>
                                </button>
                            )}

                            <button
                                onClick={(e) => { e.stopPropagation(); handleBackToProfile(); }}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-red-400 hover:text-red-300"
                                title="Salir"
                                data-no-scan="true"
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
            <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-8 overflow-hidden">

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
                                key="profile-selection"
                                options={profileOptions}
                                onSelect={handleProfileSelect}
                                columns={Math.min(scanColumns, profileOptions.length)}
                                scanInterval={scanInterval}
                                soundEnabled={true}
                                voiceEnabled={voiceEnabled}
                                isPaused={isPaused}
                            />
                        ) : (
                            <div className="text-center py-16">
                                <span className="material-symbols-outlined text-6xl text-gray-600 mb-4">person_off</span>
                                <p className="text-xl text-gray-400">No hay estudiantes registrados</p>
                                <p className="text-gray-500 mt-2">Agrega estudiantes desde el Panel Docente</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Menu and Selection Steps */}
                {['MENU', 'SELECT_PROTAGONIST', 'SELECT_SCENERY', 'SELECT_MISSION', 'SELECT_STYLE'].includes(step) && (
                    <div className="w-full max-w-5xl text-center">
                        {/* Progress Indicator */}
                        {step !== 'MENU' && (
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

                        <h2 className="text-2xl md:text-4xl font-black mb-8 animate-fade-in">
                            {step === 'MENU' && "¿Qué quieres hacer hoy?"}
                            {step === 'SELECT_PROTAGONIST' && "Elige tu Protagonista"}
                            {step === 'SELECT_SCENERY' && "Elige el Escenario"}
                            {step === 'SELECT_MISSION' && "Elige la Misión"}
                            {step === 'SELECT_STYLE' && "Elige el Estilo Visual"}
                        </h2>

                        <ScanningGrid
                            key={`grid-${step}`}
                            options={
                                step === 'MENU' ? menuOptions :
                                    step === 'SELECT_PROTAGONIST' ? protagonistOptions :
                                        step === 'SELECT_SCENERY' ? sceneryOptions :
                                            step === 'SELECT_MISSION' ? missionOptions :
                                                styleOptions
                            }
                            onSelect={
                                step === 'MENU' ? handleMenuSelect :
                                    step === 'SELECT_PROTAGONIST' ? handleProtagonistSelect :
                                        step === 'SELECT_SCENERY' ? handleScenerySelect :
                                            step === 'SELECT_MISSION' ? handleMissionSelect :
                                                handleStyleSelect
                            }
                            columns={step === 'MENU' ? 2 : Math.min(3, scanColumns + 1)}
                            scanInterval={scanInterval}
                            soundEnabled={currentStudent?.student_settings?.sound_enabled ?? true}
                            voiceEnabled={voiceEnabled}
                            isPaused={isPaused}
                        />
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
                            Volver al Menú
                        </button>
                    </div>
                )}

                {/* Generating State */}
                {step === 'GENERATING' && (
                    <GeneratingView
                        progress={generationProgress}
                        protagonist={config.protagonist}
                        scenery={config.scenery}
                        mission={config.mission}
                        style={config.style}
                        error={error}
                        onCancel={() => {
                            setStep('MENU');
                            setError(null);
                        }}
                    />
                )}
            </main>

            {/* Footer */}
            <footer className="w-full border-t border-white/10 bg-black/30 py-3 px-4 print:hidden">
                <div className="max-w-5xl mx-auto flex items-center justify-between text-gray-500">
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
                    <p className="text-gray-500 text-sm mt-6">
                        Presiona el botón flotante para continuar
                    </p>
                </div>
            )}

            {/* Floating Controls - visible when student is selected */}
            {currentStudent && step !== 'GENERATING' && (
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
