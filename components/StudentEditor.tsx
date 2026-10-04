import React, { useState, useEffect } from 'react';
import {
    createActionItem,
    deleteActionItem,
    listActionOptions,
    listActions,
    listProfileItems,
    saveProfileItems,
    updateOption,
    type ActionOptionPayload,
    type OptionPatch,
    type ProfileItemPayload,
} from '../services/backendActions';
import {
    createProfileContact,
    deleteProfileContact,
    listProfileContacts,
    updateProfileContact,
    type ProfileContactPayload,
} from '../services/backendContacts';
import type { Student, StudentSettings } from '../types/database';
import { ApiError } from '../services/backendApi';
import { t } from '../utils/messages';

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
const getIconForLabel = (label: string, category: string): string => {
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
interface ElementEntry {
    id: string;
    label: string;
    icon: string;
    isEnabled: boolean;
    level: number;
}

interface ElementSectionProps {
    title: string;
    icon: string;
    elements: ElementEntry[];
    onToggle: (id: string, enabled: boolean) => void;
    onDelete: (id: string) => void;
    onAdd: (label: string) => void;
    maxEnabled: number;
    maxPerPage: number;
    optionId: string;
    onSaveQuota: (optionId: string, patch: OptionPatch) => void;
}

const ElementSection: React.FC<ElementSectionProps> = ({
    title,
    icon,
    elements,
    onToggle,
    onDelete,
    onAdd,
    maxEnabled,
    maxPerPage,
    optionId,
    onSaveQuota
}) => {
    const [newLabel, setNewLabel] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    // SPEC-023C quota editor: local draft follows the stored quota and is
    // only pushed through onSaveQuota (PATCH options/:id) on explicit save.
    const [quotaMaxEnabled, setQuotaMaxEnabled] = useState(String(maxEnabled));
    const [quotaMaxPerPage, setQuotaMaxPerPage] = useState(String(maxPerPage));

    const enabledCount = elements.filter(e => e.isEnabled).length;
    const levelCount = (level: number) =>
        elements.filter(e => e.isEnabled && e.level === level).length;
    const canEnable = (element: ElementEntry) =>
        element.isEnabled ||
        (enabledCount < maxEnabled && levelCount(element.level) < maxPerPage);

    const handleAdd = () => {
        if (newLabel.trim()) {
            onAdd(newLabel.trim());
            setNewLabel('');
            setShowAddForm(false);
        }
    };

    const handleSaveQuota = () => {
        const parsedMaxEnabled = Number.parseInt(quotaMaxEnabled, 10);
        const parsedMaxPerPage = Number.parseInt(quotaMaxPerPage, 10);

        if (
            !Number.isInteger(parsedMaxEnabled) ||
            !Number.isInteger(parsedMaxPerPage)
        ) {
            return;
        }

        onSaveQuota(optionId, {
            // Server clamps to 1-12 (UpdateOptionDto); mirror the range here
            // so an out-of-range draft never leaves the editor.
            maxEnabled: Math.min(12, Math.max(1, parsedMaxEnabled)),
            maxPerPage: Math.min(12, Math.max(1, parsedMaxPerPage)),
        });
    };

    return (
        <div className="bg-background-dark rounded-xl p-4 border border-border-accent">
            <div className="flex items-center justify-between mb-4">
                {/* h2 under the page h1: axe heading-order stays clean. */}
                <h2 className="font-bold text-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">
                        {icon}
                    </span>
                    {title}
                </h2>
                <span className={`text-sm font-bold px-2 py-1 rounded-full ${enabledCount >= maxEnabled ? 'bg-amber-500/20 text-amber-400' : 'bg-primary/20 text-primary'
                    }`}>
                    {enabledCount}/{maxEnabled} habilitados · {maxPerPage}/página
                </span>
            </div>

            {/* SPEC-023C quota editor: raising the quota lets the teacher
                enable more items; the client-side toggle/add caps stay. */}
            <div className="flex flex-wrap items-end gap-2 mb-4">
                <label
                    htmlFor={`quota-max-enabled-${optionId}`}
                    className="flex flex-col gap-1 text-sm font-medium text-gray-400"
                >
                    {t('editor.quotaMaxEnabled')}
                    <input
                        id={`quota-max-enabled-${optionId}`}
                        type="number"
                        min={1}
                        max={12}
                        value={quotaMaxEnabled}
                        onChange={(e) => setQuotaMaxEnabled(e.target.value)}
                        aria-label={t('editor.quotaMaxEnabled')}
                        className="w-20 min-h-11 bg-surface-dark border border-border-accent rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none"
                    />
                </label>
                <label
                    htmlFor={`quota-max-per-page-${optionId}`}
                    className="flex flex-col gap-1 text-sm font-medium text-gray-400"
                >
                    {t('editor.quotaMaxPerPage')}
                    <input
                        id={`quota-max-per-page-${optionId}`}
                        type="number"
                        min={1}
                        max={12}
                        value={quotaMaxPerPage}
                        onChange={(e) => setQuotaMaxPerPage(e.target.value)}
                        aria-label={t('editor.quotaMaxPerPage')}
                        className="w-20 min-h-11 bg-surface-dark border border-border-accent rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none"
                    />
                </label>
                <button
                    type="button"
                    onClick={handleSaveQuota}
                    className="min-h-11 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-colors"
                >
                    {t('editor.quotaSave')}
                </button>
            </div>

            <div className="space-y-2 mb-4">
                {elements.map(element => (
                    <div
                        key={element.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all ${element.isEnabled
                            ? 'bg-primary/10 border-primary/30'
                            : 'bg-white/5 border-white/10'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`material-symbols-outlined ${element.isEnabled ? 'text-primary' : 'text-gray-400'}`}>
                                {element.icon}
                            </span>
                            <span className={element.isEnabled ? 'text-white' : 'text-gray-400'}>
                                {element.label}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Toggle button */}
                            <button
                                type="button"
                                aria-label={`${element.label}: ${element.isEnabled ? t('editor.disable') : t('editor.enable')}`}
                                onClick={() => {
                                    if (!canEnable(element)) {
                                        alert(
                                            enabledCount >= maxEnabled
                                                ? t('editor.limitOption')
                                                : t('editor.limitPage'),
                                        );
                                        return;
                                    }
                                    onToggle(element.id, !element.isEnabled);
                                }}
                                className={`relative w-12 h-6 rounded-full transition-colors ${element.isEnabled ? 'bg-primary' : 'bg-gray-600'
                                    }`}
                            >
                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${element.isEnabled ? 'translate-x-6' : 'translate-x-0.5'
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
                    <p className="text-gray-400 text-center py-4">No hay elementos. Agrega uno nuevo.</p>
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
    const [activeTab, setActiveTab] = useState<'profile' | 'config' | 'elements' | 'contacts'>('profile');
    const [isLoadingElements, setIsLoadingElements] = useState(false);

    const initialModules =
        student?.student_settings?.modules &&
        typeof student.student_settings.modules === 'object' &&
        !Array.isArray(student.student_settings.modules)
            ? (student.student_settings.modules as Record<string, boolean>)
            : {};

    // Student Data
    const [formData, setFormData] = useState({
        name: student?.name || '',
        avatar_icon: student?.avatar_icon || 'face',
        age: student?.age?.toString() || '',
        birthdate: student?.birthdate || '',
        notes: student?.notes || '',
        is_active: student?.is_active ?? true
    });

    // Settings Data
    const [settingsData, setSettingsData] = useState({
        scan_interval: student?.student_settings?.scan_interval || 3000,
        scan_columns: student?.student_settings?.scan_columns || 2,
        voice_feedback: student?.student_settings?.voice_feedback ?? true,
        sound_enabled: student?.student_settings?.sound_enabled ?? true,
        sweep_enabled: student?.student_settings?.sweep_enabled ?? true,
        input_mode: (student?.student_settings?.input_mode as string) || 'scan',
        font_size: (student?.student_settings?.font_size as string) || 'normal',
        line_height: (student?.student_settings?.line_height as string) || 'normal',
        bold_titles: student?.student_settings?.bold_titles ?? false,
        uppercase: student?.student_settings?.uppercase ?? false,
        voice_gender: (student?.student_settings?.voice_gender as string) || 'auto',
        modules: {
            create: initialModules.create ?? true,
            library: initialModules.library ?? true,
            design: initialModules.design ?? false
        },
        book_story_size: (student?.student_settings?.book_story_size as string) || 'medium',
        book_audience: (student?.student_settings?.book_audience as string) || 'child'
    });

    // Elements Data (SPEC-023 catalog)
    const [catalogOptions, setCatalogOptions] = useState<ActionOptionPayload[]>([]);
    const [profileItems, setProfileItems] = useState<Record<string, ProfileItemPayload>>({});
    const [elementsMessage, setElementsMessage] = useState<string | null>(null);

    // Contacts Data (SPEC-022)
    const [contacts, setContacts] = useState<ProfileContactPayload[]>([]);
    const [isLoadingContacts, setIsLoadingContacts] = useState(false);
    const [editingContactId, setEditingContactId] = useState<string | null>(null);
    const [contactMessage, setContactMessage] = useState<string | null>(null);
    const [contactForm, setContactForm] = useState({
        name: '',
        relationship: '',
        reason: ''
    });

    // Load elements when tab is selected and student exists
    useEffect(() => {
        if (activeTab === 'elements' && student?.id) {
            loadElements();
        }
    }, [activeTab, student?.id]);

    // Load contacts when tab is selected and student exists
    useEffect(() => {
        if (activeTab === 'contacts' && student?.id) {
            void loadContacts();
        }
    }, [activeTab, student?.id]);

    const loadContacts = async () => {
        if (!student?.id) return;

        setIsLoadingContacts(true);
        try {
            setContacts(await listProfileContacts(student.id));
        } catch (err) {
            console.error('Error loading contacts:', err);
        } finally {
            setIsLoadingContacts(false);
        }
    };

    const resetContactForm = () => {
        setContactForm({ name: '', relationship: '', reason: '' });
        setEditingContactId(null);
    };

    const showContactMessage = (message: string) => {
        setContactMessage(message);
        setTimeout(() => setContactMessage(null), 3000);
    };

    const handleSaveContact = async () => {
        if (
            !student?.id ||
            !contactForm.name.trim() ||
            !contactForm.relationship.trim()
        ) {
            return;
        }

        const input = {
            name: contactForm.name.trim(),
            relationship: contactForm.relationship.trim(),
            dedicationReason: contactForm.reason.trim() || undefined
        };

        try {
            if (editingContactId) {
                await updateProfileContact(editingContactId, input);
            } else {
                await createProfileContact(student.id, input);
            }

            resetContactForm();
            showContactMessage(t('editor.contactSaved'));
            await loadContacts();
        } catch (err) {
            console.error('Error saving contact:', err);
            showContactMessage(t('editor.contactError'));
        }
    };

    const handleEditContact = (contact: ProfileContactPayload) => {
        setEditingContactId(contact.id);
        setContactForm({
            name: contact.name,
            relationship: contact.relationship,
            reason: contact.dedicationReason ?? ''
        });
    };

    const handleDeleteContact = async (contactId: string) => {
        try {
            await deleteProfileContact(contactId);
            if (editingContactId === contactId) resetContactForm();
            await loadContacts();
        } catch (err) {
            console.error('Error deleting contact:', err);
            showContactMessage(t('editor.contactRemoveError'));
        }
    };

    const loadElements = async () => {
        if (!student?.id) return;

        setIsLoadingElements(true);
        try {
            const [actions, items] = await Promise.all([
                listActions(),
                listProfileItems(student.id)
            ]);
            const createAction = actions.find((action) => action.code === 'create');

            setCatalogOptions(
                createAction ? await listActionOptions(createAction.id) : []
            );
            setProfileItems(
                Object.fromEntries(items.map((item) => [item.itemId, item]))
            );
        } catch (err) {
            console.error('Error loading elements:', err);
        } finally {
            setIsLoadingElements(false);
        }
    };

    const handleToggleElement = async (itemId: string, enabled: boolean) => {
        if (!student?.id) return;

        setElementsMessage(null);
        try {
            const saved = await saveProfileItems(student.id, [
                { itemId, isEnabled: enabled }
            ]);
            setProfileItems(
                Object.fromEntries(saved.map((item) => [item.itemId, item]))
            );
        } catch (err) {
            console.error('Error toggling element:', err);
            if (err instanceof ApiError && err.code === 'LIMIT_EXCEEDED') {
                setElementsMessage(t('editor.limitExceeded'));
            }
        }
    };

    const handleDeleteElement = async (itemId: string) => {
        try {
            await deleteActionItem(itemId);
            await loadElements();
        } catch (err) {
            console.error('Error deleting element:', err);
        }
    };

    const handleAddElement = async (
        optionId: string,
        label: string,
        category: string
    ) => {
        const icon = getIconForLabel(label, category);

        try {
            await createActionItem(optionId, { label, icon });
            await loadElements();
        } catch (err) {
            console.error('Error adding element:', err);
        }
    };

    // SPEC-023C: teacher-facing quota editor backed by PATCH options/:id.
    const handleSaveQuota = async (optionId: string, patch: OptionPatch) => {
        setElementsMessage(null);
        try {
            const updated = await updateOption(optionId, patch);
            setCatalogOptions((prev) =>
                prev.map((option) =>
                    option.id === optionId ? { ...option, ...updated } : option,
                ),
            );
        } catch (err) {
            console.error('Error saving quota:', err);
            setElementsMessage(t('editor.quotaError'));
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
                birthdate: formData.birthdate || null,
                notes: formData.notes.trim() || null,
                is_active: formData.is_active
            },
            {
                scan_interval: settingsData.scan_interval,
                scan_columns: settingsData.scan_columns,
                voice_feedback: settingsData.voice_feedback,
                sound_enabled: settingsData.sound_enabled,
                sweep_enabled: settingsData.sweep_enabled,
                input_mode: settingsData.input_mode,
                font_size: settingsData.font_size,
                line_height: settingsData.line_height,
                bold_titles: settingsData.bold_titles,
                uppercase: settingsData.uppercase,
                voice_gender: settingsData.voice_gender,
                modules: settingsData.modules,
                book_story_size: settingsData.book_story_size,
                book_audience: settingsData.book_audience
            }
        );
    };

    return (
        <div className="min-h-[100dvh] bg-background-dark text-white p-6 flex flex-col">
            <div className="w-full max-w-4xl mx-auto flex flex-col flex-1 min-h-0">
                {/* Header */}
                <div className="flex items-center gap-4 mb-4">
                    <button
                        onClick={onCancel}
                        className="p-2 min-w-11 min-h-11 hover:bg-white/10 rounded-lg transition-colors"
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
                            Elementos de Creación
                        </button>
                    )}
                    {student && (
                        <button
                            onClick={() => setActiveTab('contacts')}
                            className={`px-4 py-3 font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'contacts'
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-400 hover:text-white'
                                }`}
                        >
                            <span className="material-symbols-outlined text-sm">contacts</span>
                            {t('editor.contacts')}
                        </button>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="bg-surface-dark rounded-2xl p-8 border border-border-accent flex-1 flex flex-col">

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

                                {/* Fecha de nacimiento */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                        {t('editor.birthdate')}
                                    </label>
                                    <input
                                        type="date"
                                        value={formData.birthdate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, birthdate: e.target.value }))}
                                        className="w-full bg-background-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
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

                            {/* Barrido automático */}
                            <div className="p-4 bg-background-dark rounded-xl border border-border-accent">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="material-symbols-outlined text-primary">motion_photos_on</span>
                                            <span className="font-bold">Barrido automático</span>
                                        </div>
                                        <p className="text-sm text-gray-400">
                                            Avanza solo por las opciones cada {settingsData.scan_interval / 1000} segundos
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={settingsData.sweep_enabled}
                                        onChange={(e) => setSettingsData(prev => ({ ...prev, sweep_enabled: e.target.checked }))}
                                        className="size-6 accent-[#137fec]"
                                    />
                                </label>
                            </div>

                            {/* Modo de entrada */}
                            <div className="p-4 bg-background-dark rounded-xl border border-border-accent">
                                <label className="block font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">touch_app</span>
                                    Modo de entrada
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { value: 'scan', label: 'Barrido' },
                                        { value: 'switch', label: 'Pulsador' },
                                        { value: 'mouse', label: 'Mouse' },
                                        { value: 'touch', label: 'Táctil' }
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setSettingsData(prev => ({ ...prev, input_mode: opt.value }))}
                                            className={`py-3 px-2 rounded-xl border-2 font-bold transition-all ${settingsData.input_mode === opt.value
                                                ? 'border-primary bg-primary/20 text-white'
                                                : 'border-white/10 hover:border-white/30 text-gray-400'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Texto */}
                            <div className="p-4 bg-background-dark rounded-xl border border-border-accent space-y-5">
                                <label className="block font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">format_size</span>
                                    Texto
                                </label>

                                <div>
                                    <p className="text-sm text-gray-400 mb-2">Tamaño de letra</p>
                                    <div className="flex gap-3">
                                        {[
                                            { value: 'normal', label: '16' },
                                            { value: 'large', label: '19' },
                                            { value: 'xlarge', label: '22' }
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setSettingsData(prev => ({ ...prev, font_size: opt.value }))}
                                                className={`size-12 rounded-xl border-2 flex items-center justify-center text-lg font-bold transition-all ${settingsData.font_size === opt.value
                                                    ? 'border-primary bg-primary/20 text-white'
                                                    : 'border-white/10 hover:border-white/30 text-gray-400'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm text-gray-400 mb-2">Interlineado</p>
                                    <div className="flex flex-wrap gap-3">
                                        {[
                                            { value: 'normal', label: 'Normal' },
                                            { value: 'relaxed', label: 'Amplio' },
                                            { value: 'loose', label: 'Muy amplio' }
                                        ].map(opt => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setSettingsData(prev => ({ ...prev, line_height: opt.value }))}
                                                className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${settingsData.line_height === opt.value
                                                    ? 'border-primary bg-primary/20 text-white'
                                                    : 'border-white/10 hover:border-white/30 text-gray-400'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="font-bold">Títulos en negrita</span>
                                    <input
                                        type="checkbox"
                                        checked={settingsData.bold_titles}
                                        onChange={(e) => setSettingsData(prev => ({ ...prev, bold_titles: e.target.checked }))}
                                        className="size-6 accent-[#137fec]"
                                    />
                                </label>

                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="font-bold">Mayúsculas en toda la plataforma</span>
                                    <input
                                        type="checkbox"
                                        checked={settingsData.uppercase}
                                        onChange={(e) => setSettingsData(prev => ({ ...prev, uppercase: e.target.checked }))}
                                        className="size-6 accent-[#137fec]"
                                    />
                                </label>
                            </div>

                            {/* Voz */}
                            <div className="p-4 bg-background-dark rounded-xl border border-border-accent">
                                <label className="block font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">record_voice_over</span>
                                    Tipo de voz
                                </label>
                                <div className="flex flex-wrap gap-3">
                                    {[
                                        { value: 'auto', label: 'Automática' },
                                        { value: 'female', label: 'Femenina' },
                                        { value: 'male', label: 'Masculina' }
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setSettingsData(prev => ({ ...prev, voice_gender: opt.value }))}
                                            className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${settingsData.voice_gender === opt.value
                                                ? 'border-primary bg-primary/20 text-white'
                                                : 'border-white/10 hover:border-white/30 text-gray-400'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="mt-3 text-xs text-gray-400">
                                    Si el dispositivo no tiene voz es-AR se usa es-US (limitación del sistema).
                                </p>
                            </div>

                            {/* Módulos */}
                            <div className="p-4 bg-background-dark rounded-xl border border-border-accent">
                                <label className="block font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">widgets</span>
                                    {t('editor.modules')}
                                </label>
                                <div className="space-y-3">
                                    {([
                                        { key: 'create', label: t('editor.moduleCreate') },
                                        { key: 'library', label: t('editor.moduleLibrary') },
                                        { key: 'design', label: t('editor.moduleDesign') }
                                    ] as const).map(module => (
                                        <label key={module.key} className="flex items-center justify-between cursor-pointer">
                                            <span className="font-bold">{module.label}</span>
                                            <input
                                                type="checkbox"
                                                checked={settingsData.modules[module.key]}
                                                onChange={(e) => setSettingsData(prev => ({
                                                    ...prev,
                                                    modules: { ...prev.modules, [module.key]: e.target.checked }
                                                }))}
                                                className="size-6 accent-[#137fec]"
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Complejidad del cuento */}
                            <div className="p-4 bg-background-dark rounded-xl border border-border-accent">
                                <label className="block font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">auto_stories</span>
                                    {t('editor.bookComplexity')}
                                </label>
                                <div className="flex flex-wrap gap-3">
                                    {[
                                        { value: 'short', label: t('editor.bookShort') },
                                        { value: 'medium', label: t('editor.bookMedium') },
                                        { value: 'long', label: t('editor.bookLong') }
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setSettingsData(prev => ({ ...prev, book_story_size: opt.value }))}
                                            className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${settingsData.book_story_size === opt.value
                                                ? 'border-primary bg-primary/20 text-white'
                                                : 'border-white/10 hover:border-white/30 text-gray-400'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Audiencia */}
                            <div className="p-4 bg-background-dark rounded-xl border border-border-accent">
                                <label className="block font-bold mb-4 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">groups</span>
                                    {t('editor.bookAudience')}
                                </label>
                                <div className="flex flex-wrap gap-3">
                                    {[
                                        { value: 'child', label: t('editor.audienceChild') },
                                        { value: 'teen', label: t('editor.audienceTeen') },
                                        { value: 'adult', label: t('editor.audienceAdult') }
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setSettingsData(prev => ({ ...prev, book_audience: opt.value }))}
                                            className={`py-3 px-4 rounded-xl border-2 text-sm font-bold transition-all ${settingsData.book_audience === opt.value
                                                ? 'border-primary bg-primary/20 text-white'
                                                : 'border-white/10 hover:border-white/30 text-gray-400'
                                                }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}

                    {activeTab === 'elements' && student && (
                        <div className="animate-fade-in flex-1 overflow-y-auto">
                            {isLoadingElements ? (
                                <div className="flex items-center justify-center py-12">
                                    <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
                                </div>
                            ) : catalogOptions.length === 0 ? (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                    <p className="text-amber-400 text-sm flex items-center gap-2">
                                        <span className="material-symbols-outlined">info</span>
                                        {t('editor.catalogEmpty')}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-6">
                                        <p className="text-amber-400 text-sm flex items-center gap-2">
                                            <span className="material-symbols-outlined">info</span>
                                            {t('editor.catalogHint')}
                                        </p>
                                    </div>

                                    {elementsMessage && (
                                        <div
                                            role="alert"
                                            className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl mb-6 text-red-300 flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined">error</span>
                                            {elementsMessage}
                                        </div>
                                    )}

                                    {catalogOptions.map((option) => (
                                        <ElementSection
                                            key={option.id}
                                            title={option.label}
                                            icon={option.icon}
                                            maxEnabled={option.maxEnabled}
                                            maxPerPage={option.maxPerPage}
                                            optionId={option.id}
                                            onSaveQuota={(id, patch) => void handleSaveQuota(id, patch)}
                                            elements={option.items.map((item) => ({
                                                id: item.id,
                                                label: item.label,
                                                icon: item.icon,
                                                level: item.level,
                                                isEnabled:
                                                    profileItems[item.id]?.isEnabled ??
                                                    item.isActive
                                            }))}
                                            onToggle={(id, enabled) => void handleToggleElement(id, enabled)}
                                            onDelete={(id) => void handleDeleteElement(id)}
                                            onAdd={(label) => void handleAddElement(option.id, label, option.code)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'contacts' && student && (
                        <div className="animate-fade-in flex-1 overflow-y-auto">
                            <div className="p-4 bg-background-dark rounded-xl border border-border-accent mb-6">
                                <h3 className="font-bold text-lg flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-primary">person_add</span>
                                    {editingContactId
                                        ? t('editor.contacts')
                                        : t('editor.contactAdd')}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">
                                            {t('editor.contactName')} *
                                        </label>
                                        <input
                                            type="text"
                                            value={contactForm.name}
                                            onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                                            maxLength={80}
                                            className="w-full min-h-11 bg-surface-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">
                                            {t('editor.contactRelationship')} *
                                        </label>
                                        <input
                                            type="text"
                                            value={contactForm.relationship}
                                            onChange={(e) => setContactForm(prev => ({ ...prev, relationship: e.target.value }))}
                                            maxLength={40}
                                            className="w-full min-h-11 bg-surface-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-400 mb-2">
                                            {t('editor.contactReason')}
                                        </label>
                                        <input
                                            type="text"
                                            value={contactForm.reason}
                                            onChange={(e) => setContactForm(prev => ({ ...prev, reason: e.target.value }))}
                                            maxLength={200}
                                            className="w-full min-h-11 bg-surface-dark border border-border-accent rounded-xl px-4 py-3 text-white focus:border-primary focus:outline-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <button
                                        type="button"
                                        onClick={() => void handleSaveContact()}
                                        disabled={!contactForm.name.trim() || !contactForm.relationship.trim()}
                                        className="min-h-11 px-6 py-3 bg-primary hover:bg-primary/80 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {t('editor.contactAdd')}
                                    </button>
                                    {editingContactId && (
                                        <button
                                            type="button"
                                            onClick={resetContactForm}
                                            className="min-h-11 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                                {contactMessage && (
                                    <p className="mt-3 text-sm text-primary font-bold" role="status">
                                        {contactMessage}
                                    </p>
                                )}
                            </div>

                            {isLoadingContacts ? (
                                <div className="flex items-center justify-center py-12">
                                    <span className="material-symbols-outlined text-4xl text-primary animate-spin">progress_activity</span>
                                </div>
                            ) : contacts.length === 0 ? (
                                <p className="text-center text-gray-400 py-8">
                                    {t('editor.contactsEmpty')}
                                </p>
                            ) : (
                                <ul className="space-y-3">
                                    {contacts.map((contact) => (
                                        <li
                                            key={contact.id}
                                            className="flex items-center justify-between gap-4 p-4 bg-background-dark rounded-xl border border-border-accent"
                                        >
                                            <div>
                                                <p className="font-bold">
                                                    {contact.name}
                                                    <span className="ml-2 text-sm text-gray-400">
                                                        {contact.relationship}
                                                    </span>
                                                </p>
                                                {contact.dedicationReason && (
                                                    <p className="text-sm text-gray-400">
                                                        {contact.dedicationReason}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditContact(contact)}
                                                    aria-label={`${t('editor.contacts')}: ${contact.name}`}
                                                    className="min-w-11 min-h-11 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                                                >
                                                    <span className="material-symbols-outlined">edit</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDeleteContact(contact.id)}
                                                    aria-label={`${t('editor.contactDelete')}: ${contact.name}`}
                                                    className="min-w-11 min-h-11 flex items-center justify-center bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors"
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Footer Actions */}                    <div className="flex gap-4 mt-8 pt-6 border-t border-border-accent">
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
