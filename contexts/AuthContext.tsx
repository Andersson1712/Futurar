import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { clearStorySettings } from '../utils/storySettings';
import { clearProgress } from '../utils/progressStore';

interface AuthContextType {
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
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Verificar sesión al cargar
    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                setIsAuthenticated(Boolean(session?.user));
            } catch (err) {
                console.error('Error verificando sesión:', err);
            } finally {
                setIsLoading(false);
            }
        };

        checkSession();

        // Escuchar cambios de autenticación
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                setIsAuthenticated(true);
            } else if (event === 'SIGNED_OUT') {
                setIsAuthenticated(false);
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

            // Reflect the session immediately: the SIGNED_IN event may not have
            // run by the time the caller awaits login().
            setIsAuthenticated(Boolean(data.session));
            return Boolean(data.user);
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
            // Register the auth user; the database trigger creates the teacher row.
            const { data, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name }
                }
            });

            if (authError) {
                setError(authError.message);
                return false;
            }

            return Boolean(data.user);
        } catch (err) {
            setError('Error al registrarse');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        clearStorySettings();
        clearProgress();
        setIsAuthenticated(false);
        setError(null);
    };

    const value: AuthContextType = {
        isLoading,
        error,
        login,
        register,
        logout,
        isAuthenticated
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
