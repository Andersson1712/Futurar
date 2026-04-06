import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Credenciales centralizadas del proyecto (configuradas por el administrador)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcxMjk3MDY1LCJleHAiOjE5Mjg5NzcwNjV9.oCKWAfiD85CIq1AaVf7tiaC0OQ-vUNMBaltr7-2gxxU';

// Cliente singleton de Supabase
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================
// API de Estudiantes
// =============================================

export const getActiveStudents = async () => {
    const { data, error } = await supabase
        .from('students')
        .select(`
      *,
      student_settings (*)
    `)
        .eq('is_active', true)
        .order('name');

    if (error) throw error;
    return data;
};

export const getStudentById = async (studentId: string) => {
    const { data, error } = await supabase
        .from('students')
        .select(`
      *,
      student_settings (*)
    `)
        .eq('id', studentId)
        .single();

    if (error) throw error;
    return data;
};

export const getStudentSettings = async (studentId: string) => {
    const { data, error } = await supabase
        .from('student_settings')
        .select('*')
        .eq('student_id', studentId)
        .single();

    if (error) throw error;
    return data;
};

export const updateStudentSettings = async (
    studentId: string,
    settings: Partial<Database['public']['Tables']['student_settings']['Update']>
) => {
    const { data, error } = await supabase
        .from('student_settings')
        .update(settings)
        .eq('student_id', studentId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// =============================================
// API de Historias
// =============================================

export const getStudentStories = async (studentId: string) => {
    const { data, error } = await supabase
        .from('stories')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

export const createStory = async (story: Database['public']['Tables']['stories']['Insert']) => {
    const { data, error } = await supabase
        .from('stories')
        .insert(story)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateStoryDedication = async (
    storyId: string,
    dedication: {
        dedication_to: string;
        dedication_reason: string;
        dedication_position: 'start' | 'end';
    }
) => {
    const { data, error } = await supabase
        .from('stories')
        .update(dedication)
        .eq('id', storyId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const toggleStoryFavorite = async (storyId: string, isFavorite: boolean) => {
    const { data, error } = await supabase
        .from('stories')
        .update({ is_favorite: isFavorite })
        .eq('id', storyId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const deleteStory = async (storyId: string) => {
    const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', storyId);

    if (error) throw error;
};

// =============================================
// API de Sesiones de Uso (Analytics)
// =============================================

export const startSession = async (studentId: string) => {
    const { data, error } = await supabase
        .from('usage_sessions')
        .insert({
            student_id: studentId,
            stories_created: 0,
            total_interactions: 0
        })
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateSession = async (
    sessionId: string,
    updates: { stories_created?: number; total_interactions?: number }
) => {
    const { data, error } = await supabase
        .from('usage_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const endSession = async (sessionId: string) => {
    const { data, error } = await supabase
        .from('usage_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

// =============================================
// API de Configuración de IA
// =============================================

export const getAIConfig = async () => {
    const { data, error } = await supabase
        .from('ai_config')
        .select('*')
        .limit(1)
        .single();

    // Si no existe, retornar null (el usuario aún no ha configurado)
    if (error && error.code === 'PGRST116') {
        return null;
    }
    if (error) throw error;
    return data;
};

export const createAIConfig = async (
    config: Database['public']['Tables']['ai_config']['Insert']
) => {
    const { data, error } = await supabase
        .from('ai_config')
        .insert(config)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const updateAIConfig = async (
    configId: string,
    config: Partial<Database['public']['Tables']['ai_config']['Update']>
) => {
    const { data, error } = await supabase
        .from('ai_config')
        .update(config)
        .eq('id', configId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const upsertAIConfig = async (
    config: Partial<Database['public']['Tables']['ai_config']['Insert']>
) => {
    // Intentar obtener configuración existente
    const existing = await getAIConfig();

    if (existing) {
        // Actualizar
        return updateAIConfig(existing.id, config);
    } else {
        // Crear nueva
        return createAIConfig(config);
    }
};

// =============================================
// Utilidades
// =============================================

export const checkConnection = async (): Promise<boolean> => {
    try {
        const { error } = await supabase.from('students').select('id').limit(1);
        return !error;
    } catch {
        return false;
    }
};

export default supabase;
