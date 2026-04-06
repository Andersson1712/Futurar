import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getStudentById, getActiveStudents, startSession, endSession, getStudentStories } from '../services/supabase';
import type { Student, StudentSettings, Story } from '../types/database';

// Tipo para estudiante con configuración embebida
interface StudentWithSettings extends Student {
    student_settings: StudentSettings | null;
}

interface StudentContextType {
    // Estado del estudiante actual
    currentStudent: StudentWithSettings | null;
    currentSessionId: string | null;

    // Lista de estudiantes activos (para selección de perfil)
    activeStudents: StudentWithSettings[];

    // Biblioteca del estudiante actual
    library: Story[];

    // Configuración activa
    settings: StudentSettings | null;

    // Estado de carga
    isLoading: boolean;
    error: string | null;

    // Acciones
    selectStudent: (studentId: string) => Promise<void>;
    clearStudent: () => Promise<void>;
    refreshLibrary: () => Promise<void>;
    addToLibrary: (story: Story) => void;
}

const StudentContext = createContext<StudentContextType | null>(null);

export const useStudent = (): StudentContextType => {
    const context = useContext(StudentContext);
    if (!context) {
        throw new Error('useStudent debe usarse dentro de StudentProvider');
    }
    return context;
};

interface StudentProviderProps {
    children: ReactNode;
}

export const StudentProvider: React.FC<StudentProviderProps> = ({ children }) => {
    const [currentStudent, setCurrentStudent] = useState<StudentWithSettings | null>(null);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [activeStudents, setActiveStudents] = useState<StudentWithSettings[]>([]);
    const [library, setLibrary] = useState<Story[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Cargar estudiantes activos al iniciar
    useEffect(() => {
        const loadStudents = async () => {
            try {
                setIsLoading(true);
                const students = await getActiveStudents();
                setActiveStudents(students as StudentWithSettings[]);
            } catch (err) {
                console.error('Error cargando estudiantes:', err);
                setError('No se pudieron cargar los estudiantes');
            } finally {
                setIsLoading(false);
            }
        };

        loadStudents();
    }, []);

    // Seleccionar un estudiante
    const selectStudent = async (studentId: string) => {
        try {
            setIsLoading(true);
            setError(null);

            // Terminar sesión anterior si existe
            if (currentSessionId) {
                await endSession(currentSessionId);
            }

            // Cargar datos del estudiante
            const student = await getStudentById(studentId);
            setCurrentStudent(student as StudentWithSettings);

            // Cargar biblioteca del estudiante
            const stories = await getStudentStories(studentId);
            setLibrary(stories);

            // Iniciar nueva sesión
            const session = await startSession(studentId);
            setCurrentSessionId(session.id);

        } catch (err) {
            console.error('Error al seleccionar estudiante:', err);
            setError('No se pudo cargar el perfil del estudiante');
        } finally {
            setIsLoading(false);
        }
    };

    // Limpiar estudiante actual
    const clearStudent = async () => {
        try {
            if (currentSessionId) {
                await endSession(currentSessionId);
            }
        } catch (err) {
            console.error('Error al terminar sesión:', err);
        }

        setCurrentStudent(null);
        setCurrentSessionId(null);
        setLibrary([]);
    };

    // Refrescar biblioteca
    const refreshLibrary = async () => {
        if (!currentStudent) return;

        try {
            const stories = await getStudentStories(currentStudent.id);
            setLibrary(stories);
        } catch (err) {
            console.error('Error refrescando biblioteca:', err);
        }
    };

    // Agregar historia a la biblioteca (optimistic update)
    const addToLibrary = (story: Story) => {
        setLibrary(prev => [story, ...prev]);
    };

    // Configuración del estudiante actual
    const settings = currentStudent?.student_settings || null;

    const value: StudentContextType = {
        currentStudent,
        currentSessionId,
        activeStudents,
        library,
        settings,
        isLoading,
        error,
        selectStudent,
        clearStudent,
        refreshLibrary,
        addToLibrary
    };

    return (
        <StudentContext.Provider value={value}>
            {children}
        </StudentContext.Provider>
    );
};

export default StudentContext;
