import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { Student, StudentSettings, Story } from '../types/database';
import StudentEditor from './StudentEditor';
import GlobalConfigModal from './GlobalConfigModal';

// ID de docente por defecto para modo sin autenticación
const DEFAULT_TEACHER_ID = '00000000-0000-0000-0000-000000000001';

interface StudentWithData extends Student {
    student_settings: StudentSettings | null;
    stories: Story[];
}

interface TeacherPanelProps {
    onSwitchToStudent: () => void;
}

const TeacherPanel: React.FC<TeacherPanelProps> = ({ onSwitchToStudent }) => {
    const [students, setStudents] = useState<StudentWithData[]>([]);
    const [selectedStudent, setSelectedStudent] = useState<StudentWithData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Modales
    const [showEditor, setShowEditor] = useState(false);
    const [showConfig, setShowConfig] = useState(false);

    const [editingStudent, setEditingStudent] = useState<StudentWithData | null>(null);
    const [activeTab, setActiveTab] = useState<'students' | 'stats'>('students');

    // Cargar estudiantes (automáticamente al inicio)
    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('students')
                .select(`
                  *,
                  student_settings (*),
                  stories (*)
                `)
                .order('name');

            if (error) throw error;

            // Mapper para asegurar estructura correcta (supabase a veces devuelve array en relaciones 1:1 si no está marcado explícitamente en cliente)
            const processedData = (data as any[]).map(s => ({
                ...s,
                student_settings: Array.isArray(s.student_settings) ? s.student_settings[0] : s.student_settings
            }));

            setStudents(processedData as StudentWithData[]);
        } catch (err) {
            console.error('Error cargando estudiantes:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddStudent = () => {
        setEditingStudent(null);
        setShowEditor(true);
    };

    const handleEditStudent = (student: StudentWithData) => {
        setEditingStudent(student);
        setShowEditor(true);
    };

    const handleDeleteStudent = async (studentId: string) => {
        if (!confirm('¿Estás seguro de eliminar este estudiante? Se eliminarán también todas sus historias.')) {
            return;
        }

        try {
            const { error } = await supabase
                .from('students')
                .delete()
                .eq('id', studentId);

            if (error) throw error;

            setStudents(prev => prev.filter(s => s.id !== studentId));
            if (selectedStudent?.id === studentId) {
                setSelectedStudent(null);
            }
        } catch (err) {
            console.error('Error eliminando estudiante:', err);
            alert('Error al eliminar estudiante');
        }
    };

    const handleSaveStudent = async (studentData: Partial<Student>, settingsData: Partial<StudentSettings>) => {
        try {
            let studentId = editingStudent?.id;
            const isNewStudent = !studentId;

            if (studentId) {
                // Actualizar estudiante existente
                const { error: stuError } = await supabase
                    .from('students')
                    .update(studentData)
                    .eq('id', studentId);

                if (stuError) throw stuError;
            } else {
                // Crear nuevo estudiante
                const { data: newStudent, error: stuError } = await supabase
                    .from('students')
                    .insert({
                        ...studentData,
                        teacher_id: DEFAULT_TEACHER_ID
                    })
                    .select()
                    .single();

                if (stuError) throw stuError;
                studentId = newStudent.id;
            }

            // Gestionar configuración (Settings)
            // Verificar si ya existe configuración para este estudiante
            const { data: existingSettings } = await supabase
                .from('student_settings')
                .select('id')
                .eq('student_id', studentId)
                .single();

            if (existingSettings) {
                // Actualizar settings
                const { error: setError } = await supabase
                    .from('student_settings')
                    .update(settingsData)
                    .eq('student_id', studentId);

                if (setError) throw setError;
            } else {
                // Crear settings
                const { error: setError } = await supabase
                    .from('student_settings')
                    .insert({
                        student_id: studentId,
                        ...settingsData
                    });

                if (setError) throw setError;
            }

            // Si es nuevo estudiante, crear elementos predeterminados
            if (isNewStudent && studentId) {
                await seedDefaultElements(studentId);
            }

            setShowEditor(false);
            loadStudents();
        } catch (err) {
            console.error('Error guardando estudiante:', err);
            alert('Error al guardar estudiante');
        }
    };

    // Función para insertar elementos predeterminados para un nuevo estudiante
    const seedDefaultElements = async (studentId: string) => {
        const defaultProtagonists = [
            { label: 'Animales', icon: 'pets' },
            { label: 'Personas', icon: 'face_6' },
            { label: 'Robots', icon: 'smart_toy' },
            { label: 'Fantasía', icon: 'auto_fix' }
        ];

        const defaultScenarios = [
            { label: 'Selva', icon: 'forest' },
            { label: 'Espacio', icon: 'rocket_launch' },
            { label: 'Castillo', icon: 'castle' },
            { label: 'Bajo el Mar', icon: 'water' }
        ];

        const defaultMissions = [
            { label: 'Explorar', icon: 'explore' },
            { label: 'Rescatar', icon: 'volunteer_activism' },
            { label: 'Descubrir', icon: 'search' },
            { label: 'Proteger', icon: 'shield' }
        ];

        const defaultStyles = [
            { label: 'Acuarela', icon: 'water_drop' },
            { label: 'Cartoon', icon: 'animation' },
            { label: 'Realista', icon: 'camera' },
            { label: 'Pixel Art', icon: 'grid_on' }
        ];

        try {
            await Promise.all([
                supabase.from('student_protagonists').insert(
                    defaultProtagonists.map(p => ({ student_id: studentId, ...p, is_enabled: true }))
                ),
                supabase.from('student_scenarios').insert(
                    defaultScenarios.map(s => ({ student_id: studentId, ...s, is_enabled: true }))
                ),
                supabase.from('student_missions').insert(
                    defaultMissions.map(m => ({ student_id: studentId, ...m, is_enabled: true }))
                ),
                supabase.from('student_styles').insert(
                    defaultStyles.map(st => ({ student_id: studentId, ...st, is_enabled: true }))
                )
            ]);
        } catch (err) {
            console.error('Error seeding default elements:', err);
        }
    };

    const handleToggleActive = async (student: Student) => {
        try {
            const { error } = await supabase
                .from('students')
                .update({ is_active: !student.is_active })
                .eq('id', student.id);

            if (error) throw error;
            loadStudents();
        } catch (err) {
            console.error('Error actualizando estudiante:', err);
        }
    };

    // Estadísticas
    const stats = {
        totalStudents: students.length,
        activeStudents: students.filter(s => s.is_active).length,
        totalStories: students.reduce((sum, s) => sum + (s.stories?.length || 0), 0),
        storiesThisWeek: students.reduce((sum, s) => {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            return sum + (s.stories?.filter(st =>
                new Date(st.created_at || '') > oneWeekAgo
            ).length || 0);
        }, 0)
    };

    const iconOptions = [
        'face', 'face_2', 'face_3', 'face_4', 'face_5', 'face_6',
        'emoji_people', 'accessibility_new', 'child_care', 'school'
    ];

    if (showEditor) {
        return (
            <StudentEditor
                student={editingStudent}
                onSave={handleSaveStudent}
                onCancel={() => setShowEditor(false)}
                iconOptions={iconOptions}
            />
        );
    }

    return (
        <div className="min-h-screen bg-background-dark text-white font-display">
            {/* Header */}
            <header className="bg-surface-dark border-b border-border-accent px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="size-10 bg-primary/20 text-primary flex items-center justify-center rounded-xl">
                            <span className="material-symbols-outlined">rocket</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tighter">FUTURAR</h1>
                            <p className="text-xs text-gray-400">Panel Docente</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowConfig(true)}
                            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                            title="Configuración Global"
                        >
                            <span className="material-symbols-outlined">settings</span>
                        </button>
                        <div className="h-6 w-px bg-white/10 mx-2"></div>
                        <button
                            onClick={onSwitchToStudent}
                            className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                        >
                            <span className="material-symbols-outlined">school</span>
                            Ir a Modo Estudiante
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto p-6">
                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('students')}
                        className={`px-6 py-3 rounded-xl font-bold transition-colors ${activeTab === 'students'
                            ? 'bg-primary text-white'
                            : 'bg-surface-dark text-gray-400 hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined mr-2 align-middle">group</span>
                        Mis Estudiantes
                    </button>
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`px-6 py-3 rounded-xl font-bold transition-colors ${activeTab === 'stats'
                            ? 'bg-primary text-white'
                            : 'bg-surface-dark text-gray-400 hover:text-white'
                            }`}
                    >
                        <span className="material-symbols-outlined mr-2 align-middle">analytics</span>
                        Estadísticas
                    </button>
                </div>

                {/* Content */}
                {activeTab === 'stats' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-surface-dark rounded-2xl p-6 border border-border-accent">
                            <div className="flex items-center gap-4">
                                <span className="material-symbols-outlined text-4xl text-blue-400">group</span>
                                <div>
                                    <p className="text-3xl font-black">{stats.totalStudents}</p>
                                    <p className="text-sm text-gray-400">Estudiantes</p>
                                </div>
                            </div>
                        </div>
                        {/* Más stats simplificadas por ahora */}
                        <div className="bg-surface-dark rounded-2xl p-6 border border-border-accent">
                            <div className="flex items-center gap-4">
                                <span className="material-symbols-outlined text-4xl text-purple-400">auto_stories</span>
                                <div>
                                    <p className="text-3xl font-black">{stats.totalStories}</p>
                                    <p className="text-sm text-gray-400">Historias</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'students' && (
                    <>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold">
                                {students.length} Estudiantes
                            </h2>
                            <button
                                onClick={handleAddStudent}
                                className="px-6 py-3 bg-primary hover:bg-primary/80 rounded-xl font-bold flex items-center gap-2 transition-colors"
                            >
                                <span className="material-symbols-outlined">person_add</span>
                                Agregar
                            </button>
                        </div>

                        {isLoading ? (
                            <div className="flex justify-center py-20"><span className="material-symbols-outlined animate-spin text-4xl">progress_activity</span></div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {students.map(student => (
                                    <div
                                        key={student.id}
                                        className="bg-surface-dark rounded-2xl p-6 border border-border-accent hover:border-primary/50 transition-all cursor-pointer"
                                        onClick={() => setSelectedStudent(selectedStudent?.id === student.id ? null : student)}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                                    <span className="material-symbols-outlined text-2xl">{student.avatar_icon || 'face'}</span>
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-lg">{student.name}</h3>
                                                    <div className="flex gap-2 text-xs text-gray-400 mt-1">
                                                        <span>{student.age || '?'} años</span>
                                                        <span>•</span>
                                                        <span>{student.stories?.length || 0} historias</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className={`size-3 rounded-full ${student.is_active ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                        </div>

                                        {/* Config Bagdes */}
                                        {student.student_settings && (
                                            <div className="flex gap-2 mb-4">
                                                <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400">
                                                    {student.student_settings.scan_interval ? (student.student_settings.scan_interval / 1000) + 's' : '3s'}
                                                </span>
                                                <span className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400">
                                                    {student.student_settings.voice_feedback ? 'Voz ON' : 'Voz OFF'}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex gap-2 pt-4 border-t border-border-accent">
                                            <button onClick={(e) => { e.stopPropagation(); handleEditStudent(student); }} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm">Editar</button>
                                            <button onClick={(e) => { e.stopPropagation(); handleToggleActive(student); }} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm">{student.is_active ? 'Desactivar' : 'Activar'}</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modals */}
            {showConfig && <GlobalConfigModal onClose={() => setShowConfig(false)} teacherId={DEFAULT_TEACHER_ID} />}
        </div>
    );
};

export default TeacherPanel;
