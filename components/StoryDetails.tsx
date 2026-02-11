import React, { useState } from 'react';
import { Story } from '../types/database';
import { supabase } from '../services/supabase';
import { generateStoryPDF } from '../utils/pdfGenerator';
import { speak } from '../utils/speech';

interface StoryDetailsProps {
    story: Story;
    onBack: () => void;
    onRead: () => void;
    onGoMenu: () => void;
    voiceEnabled?: boolean;
}

const StoryDetails: React.FC<StoryDetailsProps> = ({
    story,
    onBack,
    onRead,
    onGoMenu,
    voiceEnabled = true
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [showDedicationModal, setShowDedicationModal] = useState(false);
    const [dedicationText, setDedicationText] = useState('');
    const [dedicationPosition, setDedicationPosition] = useState<'start' | 'end'>('start');
    const [exportStatus, setExportStatus] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [hasSaved, setHasSaved] = useState(false);

    const handleSave = async () => {
        if (isSaving || hasSaved) return;
        setIsSaving(true);
        if (voiceEnabled) speak('Guardando tu cuento en la biblioteca...');

        try {
            const { error } = await supabase.from('stories').insert({
                student_id: story.student_id,
                title: story.title,
                content: story.content,
                protagonist: story.protagonist,
                scenery: story.scenery,
                mission: story.mission,
                style: story.style,
                image_url: story.image_url,
                type: 'story'
            });

            if (error) throw error;

            setHasSaved(true);
            if (voiceEnabled) speak('¡Cuento guardado con éxito!');
        } catch (err) {
            console.error('Error saving story:', err);
            if (voiceEnabled) speak('Hubo un problema al guardar el cuento.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportClick = () => {
        setShowDedicationModal(true);
    };

    const handleGeneratePDF = async () => {
        setIsExporting(true);
        setExportStatus('Iniciando...');
        if (voiceEnabled) speak('Generando tu cuento en PDF, por favor espera un momento.');

        try {
            await generateStoryPDF({
                title: story.title,
                content: story.content || '',
                protagonist: story.protagonist,
                scenery: story.scenery,
                mission: story.mission,
                style: story.style,
                images: story.image_url ? { 0: story.image_url } : {},
                dedication: dedicationText.trim() ? {
                    text: dedicationText,
                    position: dedicationPosition
                } : undefined,
                onProgress: (status) => setExportStatus(status)
            });

            setExportStatus('¡Listo!');
            if (voiceEnabled) speak('Tu PDF ha sido descargado correctamente.');
            setShowDedicationModal(false);
        } catch (error) {
            console.error(error);
            setExportStatus('Error al generar PDF');
            if (voiceEnabled) speak('Hubo un error al generar el PDF.');
        } finally {
            setIsExporting(false);
            setTimeout(() => setExportStatus(''), 3000);
        }
    };

    return (
        <div className="w-full h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 p-6 md:p-8 animate-fade-in relative">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                    <span>Volver a la Biblioteca</span>
                </button>
            </div>

            <div className="flex-1 flex flex-col md:flex-row gap-8 items-center max-w-6xl mx-auto w-full">

                {/* Portada */}
                <div className="w-full md:w-1/3 aspect-[3/4] bg-slate-800 rounded-2xl overflow-hidden shadow-2xl relative group">
                    {story.image_url ? (
                        <img
                            src={story.image_url}
                            alt={story.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-700">
                            <span className="material-symbols-outlined text-6xl text-slate-500">auto_stories</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                </div>

                {/* Info y Acciones */}
                <div className="w-full md:w-2/3 space-y-8">
                    <div>
                        <h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight">
                            {story.title}
                        </h1>
                        <div className="flex flex-wrap gap-3">
                            <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-bold border border-primary/20">
                                {story.protagonist}
                            </span>
                            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-bold border border-blue-500/20">
                                {story.scenery}
                            </span>
                            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm font-bold border border-purple-500/20">
                                {story.style}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={onRead}
                            className="flex-1 min-w-[200px] py-4 bg-primary hover:bg-primary/90 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition-all hover:scale-105 shadow-lg shadow-primary/20"
                        >
                            <span className="material-symbols-outlined text-3xl">auto_stories</span>
                            Leer Cuento
                        </button>

                        <button
                            onClick={handleExportClick}
                            className="flex-1 min-w-[200px] py-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-2xl font-bold text-xl text-white flex items-center justify-center gap-3 transition-all hover:scale-105"
                        >
                            <span className="material-symbols-outlined text-3xl">picture_as_pdf</span>
                            Descargar PDF
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={isSaving || hasSaved}
                            className={`flex-1 min-w-[200px] py-4 rounded-2xl font-bold text-xl flex items-center justify-center gap-3 transition-all hover:scale-105 shadow-lg ${hasSaved
                                ? 'bg-green-600 text-white cursor-default'
                                : 'bg-white text-slate-900 hover:bg-gray-100'}`}
                        >
                            <span className="material-symbols-outlined text-3xl">
                                {hasSaved ? 'check_circle' : (isSaving ? 'progress_activity' : 'bookmark_add')}
                            </span>
                            {hasSaved ? 'Guardado' : (isSaving ? 'Guardando...' : 'Guardar')}
                        </button>
                    </div>

                    <div className="flex justify-center mt-4">
                        <button
                            onClick={onGoMenu}
                            className="px-8 py-3 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-full text-gray-300 hover:text-white font-bold transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined">home</span>
                            Volver al Menú Principal
                        </button>
                    </div>

                    <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                        <h3 className="text-lg font-bold text-gray-300 mb-2 flex items-center gap-2">
                            <span className="material-symbols-outlined text-yellow-500">lightbulb</span>
                            Detalles de la Misión
                        </h3>
                        <p className="text-gray-400">
                            {story.mission}
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal de Dedicatoria */}
            {showDedicationModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">favorite</span>
                                Agregar Dedicatoria
                            </h2>
                            <button
                                onClick={() => setShowDedicationModal(false)}
                                className="text-gray-400 hover:text-white"
                                disabled={isExporting}
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-2">
                                    Mensaje especial
                                </label>
                                <textarea
                                    value={dedicationText}
                                    onChange={(e) => setDedicationText(e.target.value)}
                                    placeholder="Para mi querido..."
                                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-primary min-h-[120px]"
                                    disabled={isExporting}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-400 mb-3">
                                    Posición en el cuento
                                </label>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => setDedicationPosition('start')}
                                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${dedicationPosition === 'start'
                                            ? 'bg-primary/20 border-primary text-white'
                                            : 'bg-slate-800 border-slate-700 text-gray-400 hover:bg-slate-750'
                                            }`}
                                        disabled={isExporting}
                                    >
                                        <div className="w-8 h-10 border-2 border-current rounded-sm flex flex-col p-1 gap-1">
                                            <div className="w-full h-1 bg-current rounded-full"></div>
                                            <div className="w-2/3 h-1 bg-current/50 rounded-full"></div>
                                        </div>
                                        <span className="font-bold">Al Inicio</span>
                                    </button>

                                    <button
                                        onClick={() => setDedicationPosition('end')}
                                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${dedicationPosition === 'end'
                                            ? 'bg-primary/20 border-primary text-white'
                                            : 'bg-slate-800 border-slate-700 text-gray-400 hover:bg-slate-750'
                                            }`}
                                        disabled={isExporting}
                                    >
                                        <div className="w-8 h-10 border-2 border-current rounded-sm flex flex-col-reverse p-1 gap-1">
                                            <div className="w-full h-1 bg-current rounded-full"></div>
                                            <div className="w-2/3 h-1 bg-current/50 rounded-full"></div>
                                        </div>
                                        <span className="font-bold">Al Final</span>
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleGeneratePDF}
                                disabled={isExporting}
                                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${isExporting
                                    ? 'bg-gray-600 cursor-wait'
                                    : 'bg-white text-slate-900 hover:bg-gray-100 hover:scale-[1.02]'
                                    }`}
                            >
                                {isExporting ? (
                                    <>
                                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                        {exportStatus || 'Generando...'}
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined">download</span>
                                        Descargar PDF
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoryDetails;
