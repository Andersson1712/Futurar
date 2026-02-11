import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import type { Teacher } from '../types/database';

interface AuthContextType {
    teacher: Teacher | null;
    isLoading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<boolean>;
    register: (email: string, password: string, name: string) => Promise<boolean>;
    logout: () => Promise<void>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [teacher, setTeacher] = useState<Teacher | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Verificar sesión al cargar
    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    // Cargar perfil del docente
                    const { data: teacherData } = await supabase
                        .from('teachers')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    setTeacher(teacherData);
                }
            } catch (err) {
                console.error('Error verificando sesión:', err);
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();

        // Escuchar cambios de autenticación
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const { data: teacherData } = await supabase
                    .from('teachers')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                setTeacher(teacherData);
            } else if (event === 'SIGNED_OUT') {
                setTeacher(null);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string): Promise<boolean> => {
        setError(null);
        setIsLoading(true);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                setError(authError.message === 'Invalid login credentials'
                    ? 'Credenciales inválidas'
                    : authError.message);
                return false;
            }

            if (data.user) {
                const { data: teacherData } = await supabase
                    .from('teachers')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                setTeacher(teacherData);
                return true;
            }

            return false;
        } catch (err) {
            setError('Error al iniciar sesión');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const register = async (email: string, password: string, name: string): Promise<boolean> => {
        setError(null);
        setIsLoading(true);

        try {
            // Registrar usuario en Supabase Auth
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password
            });

            if (authError) {
                setError(authError.message);
                return false;
            }

            if (data.user) {
                // Crear perfil de docente
                const { error: profileError } = await supabase
                    .from('teachers')
                    .insert({
                        id: data.user.id,
                        email,
                        name,
                        role: 'teacher'
                    });

                if (profileError) {
                    setError('Error al crear perfil');
                    return false;
                }

                return true;
            }

            return false;
        } catch (err) {
            setError('Error al registrarse');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setTeacher(null);
    };

    const value: AuthContextType = {
        teacher,
        isLoading,
        error,
        login,
        register,
        logout,
        isAuthenticated: !!teacher
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
