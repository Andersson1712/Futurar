import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginFormProps {
    onSuccess: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
    const { login, register, error, isLoading } = useAuth();
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        confirmPassword: ''
    });
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLocalError(null);

        if (isRegisterMode) {
            // Validaciones para registro
            if (!formData.name.trim()) {
                setLocalError('El nombre es requerido');
                return;
            }
            if (formData.password.length < 6) {
                setLocalError('La contraseña debe tener al menos 6 caracteres');
                return;
            }
            if (formData.password !== formData.confirmPassword) {
                setLocalError('Las contraseñas no coinciden');
                return;
            }

            const success = await register(formData.email, formData.password, formData.name);
            if (success) {
                setLocalError('¡Registro exitoso! Revisa tu correo para confirmar la cuenta.');
                setIsRegisterMode(false);
            }
        } else {
            const success = await login(formData.email, formData.password);
            if (success) {
                onSuccess();
            }
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-dark p-6">
            <div className="w-full max-w-md">
                {/* Logo y título */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center size-20 bg-primary/20 rounded-2xl mb-4">
                        <span className="material-symbols-outlined text-5xl text-primary">rocket</span>
                    </div>
                    <h1 className="text-4xl font-black tracking-tighter">FUTURAR</h1>
                    <p className="text-gray-400 mt-2">Panel de Administración</p>
                </div>

                {/* Formulario */}
                <form onSubmit={handleSubmit} className="bg-surface-dark rounded-3xl p-8 border border-border-accent">
                    <h2 className="text-2xl font-bold mb-6">
                        {isRegisterMode ? 'Crear Cuenta' : 'Iniciar Sesión'}
                    </h2>

                    {/* Mensajes de error */}
                    {(error || localError) && (
                        <div className={`mb-6 p-4 rounded-xl text-sm ${localError?.includes('exitoso')
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                            {error || localError}
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* Nombre (solo registro) */}
                        {isRegisterMode && (
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Nombre completo
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                                    placeholder="Tu nombre"
                                />
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Correo electrónico
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                                placeholder="correo@ejemplo.com"
                                required
                            />
                        </div>

                        {/* Contraseña */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {/* Confirmar contraseña (solo registro) */}
                        {isRegisterMode && (
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Confirmar contraseña
                                </label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                                    placeholder="••••••••"
                                />
                            </div>
                        )}
                    </div>

                    {/* Botón submit */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full mt-6 py-4 bg-primary hover:bg-primary/80 rounded-xl font-bold text-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                {isRegisterMode ? 'Registrando...' : 'Iniciando sesión...'}
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">
                                    {isRegisterMode ? 'person_add' : 'login'}
                                </span>
                                {isRegisterMode ? 'Crear Cuenta' : 'Iniciar Sesión'}
                            </>
                        )}
                    </button>

                    {/* Toggle modo */}
                    <div className="mt-6 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsRegisterMode(!isRegisterMode);
                                setLocalError(null);
                            }}
                            className="text-primary hover:underline text-sm"
                        >
                            {isRegisterMode
                                ? '¿Ya tienes cuenta? Inicia sesión'
                                : '¿No tienes cuenta? Regístrate'}
                        </button>
                    </div>
                </form>

                {/* Footer */}
                <p className="text-center text-gray-500 text-sm mt-6">
                    © 2025 Futurar Universal Access
                </p>
            </div>
        </div>
    );
};

export default LoginForm;
