import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import type { Student, StudentSettings, StudentElement } from '../types/database';

interface StudentWithSettings extends Student {
    student_settings?: StudentSettings | null;
}

interface StudentEditorProps {
    student: StudentWithSettings | null;
    onSave: (studentData: Partial<Student>, settingsData: Partial<StudentSettings>) => void;
    onCancel: () => void;
    iconOptions: string[];
}

// Icon mapping based on element name keywords
const getIconForLabel = (label: string, category: 'protagonist' | 'scenario' | 'mission' | 'style'): string => {
    const labelLower = label.toLowerCase();

    // Protagonist icons
    if (category === 'protagonist') {
        if (labelLower.includes('animal') || labelLower.includes('perro') || labelLower.includes('gato')) return 'pets';
        if (labelLower.includes('persona') || labelLower.includes('niño') || labelLower.includes('niña')) return 'face_6';
        if (labelLower.includes('robot')) return 'smart_toy';
        if (labelLower.includes('fantasía') || labelLower.includes('dragon') || labelLower.includes('unicornio')) return 'auto_fix';
        if (labelLower.includes('superhero') || labelLower.includes('héroe')) return 'bolt';
        if (labelLower.includes('princesa') || labelLower.includes('príncipe')) return 'diamond';
        return 'face';
    }

    // Scenario icons
    if (category === 'scenario') {
        if (labelLower.includes('selva') || labelLower.includes('bosque')) return 'forest';
        if (labelLower.includes('espacio') || labelLower.includes('planeta')) return 'rocket_launch';
        if (labelLower.includes('castillo') || labelLower.includes('palacio')) return 'castle';
        if (labelLower.includes('mar') || labelLower.includes('océano') || labelLower.includes('agua')) return 'water';
        if (labelLower.includes('ciudad')) return 'location_city';
        if (labelLower.includes('montaña')) return 'terrain';
        if (labelLower.includes('desierto')) return 'wb_sunny';
        if (labelLower.includes('playa')) return 'beach_access';
        return 'landscape';
    }

    // Mission icons
    if (category === 'mission') {
        if (labelLower.includes('explorar') || labelLower.includes('aventura')) return 'explore';
        if (labelLower.includes('rescatar') || labelLower.includes('salvar')) return 'volunteer_activism';
        if (labelLower.includes('descubrir') || labelLower.includes('buscar')) return 'search';
        if (labelLower.includes('proteger') || labelLower.includes('defender')) return 'shield';
        if (labelLower.includes('aprender')) return 'school';
        if (labelLower.includes('amigo') || labelLower.includes('amistad')) return 'people';
        if (labelLower.includes('encontrar') || labelLower.includes('tesoro')) return 'emoji_events';
        return 'flag';
    }

    // Style icons
    if (category === 'style') {
        if (labelLower.includes('acuarela') || labelLower.includes('agua')) return 'water_drop';
        if (labelLower.includes('cartoon') || labelLower.includes('animado')) return 'animation';
        if (labelLower.includes('realista') || labelLower.includes('foto')) return 'camera';
        if (labelLower.includes('pixel')) return 'grid_on';
        if (labelLower.includes('3d')) return 'view_in_ar';
        if (labelLower.includes('comic')) return 'auto_stories';
        return 'palette';
    }

    return 'category';
};

// Element section component
interface ElementSectionProps {
    title: string;
    category: 'protagonist' | 'scenario' | 'mission' | 'style';
    elements: StudentElement[];
    onToggle: (id: string, enabled: boolean) => void;
    onDelete: (id: string) => void;
    onAdd: (label: string) => void;
    maxEnabled: number;
}

const ElementSection: React.FC<ElementSectionProps> = ({
    title,
    category,
    elements,
    onToggle,
    onDelete,
    onAdd,
    maxEnabled
}) => {
    const [newLabel, setNewLabel] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);

    const enabledCount = elements.filter(e => e.is_enabled).length;
    const canEnableMore = enabledCount < maxEnabled;

    const handleAdd = () => {
        if (newLabel.trim()) {
            onAdd(newLabel.trim());
            setNewLabel('');
            setShowAddForm(false);
        }
    };

    return (
        <div className="bg-background-dark rounded-xl p-4 border border-border-accent">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">
                        {category === 'protagonist' ? 'face' :
                            category === 'scenario' ? 'landscape' :
                                category === 'mission' ? 'flag' : 'palette'}
                    </span>
                    {title}
                </h3>
                <span className={`text-sm font-bold px-2 py-1 rounded-full ${enabledCount >= maxEnabled ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'
                    }`}>
                    {enabledCount}/{maxEnabled} habilitados
                </span>
            </div>

            <div className="space-y-2 mb-4">
                {elements.map(element => (
                    <div
                        key={element.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${element.is_enabled
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-white/5 border-white/10'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`material-symbols-outlined ${element.is_enabled ? 'text-primary' : 'text-gray-500'}`}>
                                {element.icon}
                            </span>
                            <span className={element.is_enabled ? 'text-white' : 'text-gray-400'}>
                                {element.label}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Toggle button */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (!element.is_enabled && !canEnableMore) {
                                        alert(`Solo puedes tener ${maxEnabled} elementos habilitados. Deshabilita uno primero.`);
                                        return;
                                    }
                                    onToggle(element.id, !element.is_enabled);
                                }}
                                className={`relative w-12 h-6 rounded-full transition-colors ${element.is_enabled ? 'bg-primary' : 'bg-gray-600'
                                    }`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${element.is_enabled ? 'translate-x-6' : 'translate-x-0.5'
                                    }`} />
                            </button>
                            {/* Delete button */}
                            <button
                                type="button"
                                onClick={() => {
                                    if (confirm(`¿Eliminar "${element.label}"?`)) {
                                        onDelete(element.id);
                                    }
                                }}
                                className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>
                    </div>
                ))}

                {elements.length === 0 && (
                    <p className="text-gray-500 text-center py-4">No hay elementos. Agrega uno nuevo.</p>
                )}
            </div>

            {/* Add new element */}
            {showAddForm ? (
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Nombre del elemento..."
                        className="flex-1 bg-surface-dark border border-border-accent rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAdd();
                            if (e.key === 'Escape') setShowAddForm(false);
                        }}
                    />
                    <button
                        type="button"
                        onClick={handleAdd}
                        className="px-4 py-2 bg-primary hover:bg-primary/80 rounded-lg font-bold transition-colors"
                    >
                        Agregar
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="w-full py-2 border-2 border-dashed border-white/20 hover:border-primary/50 rounded-lg text-gray-400 hover:text-primary flex items-center justify-center gap-2 transition-colors"
                >
                    <span className="material-symbols-outlined">add</span>
                    Agregar nuevo
                </button>
            )}
        </div>
    );
};

const StudentEditor: React.FC<StudentEditorProps> = ({
    student,
    onSave,
    onCancel,
    iconOptions
}) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'config' | 'elements'>('profile');
    const [isLoadingElements, setIsLoadingElements] = useState(false);

    // Student Data
    const [formData, setFormData] = useState({
        name: student?.name || '',
        avatar_icon: student?.avatar_icon || 'face',
        age: student?.age?.toString() || '',
        notes: student?.notes || '',
        is_active: student?.is_active ?? true
    });

    // Settings Data
    const [settingsData, setSettingsData] = useState({
        scan_interval: student?.student_settings?.scan_interval || 3000,
        scan_columns: student?.student_settings?.scan_columns || 2,
        voice_feedback: student?.student_settings?.voice_feedback ?? true,
        sound_enabled: student?.student_settings?.sound_enabled ?? true,
        story_length: student?.student_settings?.story_length || 'medium',
        target_audience: student?.student_settings?.target_audience || 'child'
    });

    // Elements Data
    const [protagonists, setProtagonists] = useState<StudentElement[]>([]);
    const [scenarios, setScenarios] = useState<StudentElement[]>([]);
    const [missions, setMissions] = useState<StudentElement[]>([]);
    const [styles, setStyles] = useState<StudentElement[]>([]);

    // Load elements when tab is selected and student exists
    useEffect(() => {
        if (activeTab === 'elements' && student?.id) {
            loadElements();
        }
    }, [activeTab, student?.id]);

    const loadElements = async () => {
        if (!student?.id) return;

        setIsLoadingElements(true);
        try {
            const [protRes, scenRes, missRes, styleRes] = await Promise.all([
                supabase.from('student_protagonists').select('*').eq('student_id', student.id),
                supabase.from('student_scenarios').select('*').eq('student_id', student.id),
                supabase.from('student_missions').select('*').eq('student_id', student.id),
                supabase.from('student_styles').select('*').eq('student_id', student.id)
            ]);

            setProtagonists(protRes.data || []);
            setScenarios(scenRes.data || []);
            setMissions(missRes.data || []);
            setStyles(styleRes.data || []);
        } catch (err) {
            console.error('Error loading elements:', err);
        } finally {
            setIsLoadingElements(false);
        }
    };

    // Element CRUD operations
    type ElementTable = 'student_protagonists' | 'student_scenarios' | 'student_missions' | 'student_styles';

    const handleToggleElement = async (table: ElementTable, id: string, enabled: boolean) => {
        try {
            await supabase.from(table).update({ is_enabled: enabled }).eq('id', id);
            loadElements(); // Reload to sync state
        } catch (err) {
            console.error('Error toggling element:', err);
        }
    };

    const handleDeleteElement = async (table: ElementTable, id: string) => {
        try {
            await supabase.from(table).delete().eq('id', id);
            loadElements();
        } catch (err) {
            console.error('Error deleting element:', err);
        }
    };

    const handleAddElement = async (table: ElementTable, label: string, category: 'protagonist' | 'scenario' | 'mission' | 'style') => {
        if (!student?.id) return;

        const icon = getIconForLabel(label, category);
        try {
            await supabase.from(table).insert({
                student_id: student.id,
                label,
                icon,
                is_enabled: true
            });
            loadElements();
        } catch (err) {
            console.error('Error adding element:', err);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            alert('El nombre es requerido');
            return;
        }

        onSave(
            {
                name: formData.name.trim(),
                avatar_icon: formData.avatar_icon,
                age: formData.age ? parseInt(formData.age) : null,
                notes: formData.notes.trim() || null,
                is_active: formData.is_active
            },
            {
                scan_interval: settingsData.scan_interval,
                scan_columns: settingsData.scan_columns,
                voice_feedback: settingsData.voice_feedback,
                sound_enabled: settingsData.sound_enabled,
                story_length: settingsData.story_length,
                target_audience: settingsData.target_audience
            }
        );
    };

    return (
        <div className="h-screen bg-background-dark text-white p-6 flex flex-col overflow-hidden">
            <div className="max-w-4xl mx-auto flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-4 mb-4">
                    <button
                        onClick={onCancel}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="text-3xl font-black">
                        {student ? 'Editar Estudiante' : 'Nuevo Estudiante'}
                    </h1>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6 border-b border-white/10 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`px-4 py-3 font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'profile'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Perfil General
                    </button>
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`px-4 py-3 font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'config'
                            ? 'border-primary text-primary'
                            : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Accesibilidad
                    </button>
                    {student && (
                        <button
                            onClick={() => setActiveTab('elements')}
                            className={`px-4 py-3 font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'elements'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            <span className="material-symbols-outlined text-sm">auto_stories</span>
                            Configuración de Cuentos
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="bg-surface-dark rounded-2xl p-8 border border-border-accent flex-1 flex flex-col overflow-hidden">

                    {activeTab === 'profile' && (
                        <div className="animate-fade-in flex-1 overflow-y-auto">
                            {/* Selección de icono */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-400 mb-3">
                                    Icono del perfil
                                </label>
                                <div className="flex flex-wrap gap-3">
                                    {iconOptions.map(icon => (
                                        <button
                                            key={icon}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, avatar_icon: icon }))}
                                            className={`size-14 rounded-xl flex items-center justify-center transition-all ${formData.avatar_icon === icon
                                                ? 'bg-primary text-white scale-110 ring-2 ring-primary ring-offset-2 ring-offset-surface-dark'
                                                : 'bg-background-dark hover:bg-white/10'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-2xl">{icon}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                {/* Nombre */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Nombre del estudiante *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white text-lg focus:border-primary focus:outline-none"
                                        placeholder="Ej: María García"
                                        required
                                    />
                                </div>

                                {/* Edad */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        Edad (opcional)
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.age}
                                        onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                                        className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                                        placeholder="Ej: 8"
                                        min="1"
                                        max="99"
                                    />
                                </div>
                            </div>

                            {/* Notas */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                    Notas (opcional)
                                </label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none resize-none"
                                    placeholder="Preferencias, necesidades especiales, observaciones..."
                                    rows={4}
                                />
                            </div>

                            {/* Estado activo */}
                            <div className="mb-8">
                                <label className="flex items-center justify-between cursor-pointer p-4 bg-background-dark rounded-xl border border-border-accent hover:border-gray-500 transition-colors">
                                    <div>
                                        <span className="font-medium">Estudiante activo</span>
                                        <p className="text-sm text-gray-400">
                                            Visible en la pantalla de inicio
                                        </p>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-14 h-8 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'config' && (
                        <div className="animate-fade-in space-y-6 flex-1 overflow-y-auto">
                            {/* Velocidad de barrido */}
                            <div className="p-4 bg-background-dark rounded-xl border border-border-accent">
                                <label className="block font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">speed</span>
                                    Velocidad de Barrido (Escaneo)
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {[
                                        { label: 'Lento (5s)', value: 5000 },
                                        { label: 'Normal (3s)', value: 3000 },
                                        { label: 'Rápido (1.5s)', value: 1500 }
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setSettingsData(prev => ({ ...prev, scan_interval: opt.value }))}
                                            className={`py-3 px-4 rounded-xl border-2 transition-all ${settingsData.scan_interval === opt.value
                                                ? 'border-primary bg-primary/20 text-white'
                                                : 'border-white/10 hover:border-white/30 text-gray-400'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-3 text-sm text-gray-400">
                                    Tiempo que permanece seleccionada cada opción antes de pasar a la siguiente.
                                </p>
                            </div>

                            {/* Columnas Grid */}
                            <div className="p-4 bg-background-dark rounded-xl border border-border-accent">
                                <label className="block font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">grid_view</span>
                                    Distribución (Columnas)
                                </label>
                                <div className="flex gap-4">
                                    {[1, 2, 3, 4].map(cols => (
                                        <button
                                            key={cols}
                                            type="button"
                                            onClick={() => setSettingsData(prev => ({ ...prev, scan_columns: cols }))}
                                            className={`size-12 rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-all ${settingsData.scan_columns === cols
                                                ? 'border-primary bg-primary/20 text-white'
                                                : 'border-white/10 hover:border-white/30 text-gray-400'
                                                }`}
                                        >
                                            {cols}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Asistente de Voz */}
                            <div className="p-4 bg-background-dark rounded-xl border border-border-accent">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-primary">record_voice_over</span>
                                            <span className="font-bold">Asistente de Voz (TTS)</span>
                                        </div>
                                        <p className="text-sm text-gray-400">
                                            Leer en voz alta las opciones seleccionadas y los cuentos
                                        </p>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={settingsData.voice_feedback}
                                            onChange={(e) => setSettingsData(prev => ({ ...prev, voice_feedback: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-14 h-8 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary"></div>
                                    </div>
                                </label>
                            </div>

                        </div>
                    )}

                    {activeTab === 'elements' && student && (
                        <div className="animate-fade-in flex-1 overflow-y-auto">
                            {isLoadingElements ? (
                                <div className="flex items-center justify-center py-12">
                                    <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {/* Configuración de Cuentos */}
                                    <div className="bg-surface-dark rounded-xl p-4 border border-border-accent">
                                        <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                                            <span className="material-symbols-outlined text-primary">tune</span>
                                            Preferencias de Generación
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Largo del Cuento */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                                    Largo del Cuento
                                                </label>
                                                <div className="flex gap-2">
                                                    {[
                                                        { value: 'short', label: 'Corto' },
                                                        { value: 'medium', label: 'Medio' },
                                                        { value: 'long', label: 'Largo' }
                                                    ].map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => setSettingsData(prev => ({ ...prev, story_length: opt.value as any }))}
                                                            className={`flex-1 py-2 px-3 rounded-lg border transition-all ${settingsData.story_length === opt.value
                                                                ? 'bg-primary text-white border-primary'
                                                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                                                }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Público Objetivo */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-2">
                                                    Público Objetivo
                                                </label>
                                                <div className="flex gap-2">
                                                    {[
                                                        { value: 'child', label: 'Niño' },
                                                        { value: 'adolescent', label: 'Adolescente' },
                                                        { value: 'adult', label: 'Adulto' }
                                                    ].map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => setSettingsData(prev => ({ ...prev, target_audience: opt.value as any }))}
                                                            className={`flex-1 py-2 px-3 rounded-lg border transition-all ${settingsData.target_audience === opt.value
                                                                ? 'bg-primary text-white border-primary'
                                                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                                                }`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-6">
                                        <p className="text-amber-400 text-sm flex items-center gap-2">
                                            <span className="material-symbols-outlined">info</span>
                                            Puedes habilitar hasta <strong>4 elementos</strong> por categoría. El icono se genera automáticamente según el nombre.
                                        </p>
                                    </div>

                                    <ElementSection
                                        title="Personajes"
                                        category="protagonist"
                                        elements={protagonists}
                                        maxEnabled={4}
                                        onToggle={(id, enabled) => handleToggleElement('student_protagonists', id, enabled)}
                                        onDelete={(id) => handleDeleteElement('student_protagonists', id)}
                                        onAdd={(label) => handleAddElement('student_protagonists', label, 'protagonist')}
                                    />

                                    <ElementSection
                                        title="Escenarios"
                                        category="scenario"
                                        elements={scenarios}
                                        maxEnabled={4}
                                        onToggle={(id, enabled) => handleToggleElement('student_scenarios', id, enabled)}
                                        onDelete={(id) => handleDeleteElement('student_scenarios', id)}
                                        onAdd={(label) => handleAddElement('student_scenarios', label, 'scenario')}
                                    />

                                    <ElementSection
                                        title="Misiones"
                                        category="mission"
                                        elements={missions}
                                        maxEnabled={4}
                                        onToggle={(id, enabled) => handleToggleElement('student_missions', id, enabled)}
                                        onDelete={(id) => handleDeleteElement('student_missions', id)}
                                        onAdd={(label) => handleAddElement('student_missions', label, 'mission')}
                                    />

                                    <ElementSection
                                        title="Estilos Visuales"
                                        category="style"
                                        elements={styles}
                                        maxEnabled={4}
                                        onToggle={(id, enabled) => handleToggleElement('student_styles', id, enabled)}
                                        onDelete={(id) => handleDeleteElement('student_styles', id)}
                                        onAdd={(label) => handleAddElement('student_styles', label, 'style')}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="flex gap-4 mt-8 pt-6 border-t border-border-accent">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-4 bg-primary hover:bg-primary/80 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"
                        >
                            <span className="material-symbols-outlined">save</span>
                            {student ? 'Guardar Cambios' : 'Crear Estudiante'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StudentEditor;
