
import React, { useState, useEffect, useMemo } from 'react';
import { AppStep, StoryConfig, ScanOption, DedicationConfig } from './types';
import ScanningGrid from './components/ScanningGrid';
import { generateStoryContent, generateStoryImage } from './services/gemini';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.PROFILE);
  const [activeUser, setActiveUser] = useState<string>('');
  const [config, setConfig] = useState<StoryConfig>({
    protagonist: '',
    scenery: '',
    mission: '',
    style: '',
    type: 'story'
  });
  const [dedication, setDedication] = useState<DedicationConfig>({
    to: '',
    reason: '',
    position: 'start'
  });
  const [library, setLibrary] = useState<StoryConfig[]>([]);
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<StoryConfig | null>(null);

  // --- Opciones de Selección ---
  const profileOptions: ScanOption[] = [
    { id: 'u1', label: 'Mateo', icon: 'face', description: 'Perfil 1' },
    { id: 'u2', label: 'Sofía', icon: 'face_3', description: 'Perfil 2' },
    { id: 'guest', label: 'Invitado', icon: 'account_circle', description: 'Sin registro' }
  ];

  const mainActions: ScanOption[] = [
    { id: 'story', label: 'Crear Cuento', icon: 'auto_stories' },
    { id: 'design', label: 'Crear Diseño', icon: 'brush' },
    { id: 'library', label: 'Mi Biblioteca', icon: 'shelves' }
  ];

  const protagonistOptions: ScanOption[] = [
    { id: 'animals', label: 'Animales', icon: 'pets' },
    { id: 'people', label: 'Personas', icon: 'face_6' },
    { id: 'robots', label: 'Robots', icon: 'smart_toy' },
    { id: 'fantasy', label: 'Fantasía', icon: 'auto_fix' }
  ];

  const sceneryOptions: ScanOption[] = [
    { id: 'forest', label: 'Selva', icon: 'landscape', image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&auto=format' },
    { id: 'space', label: 'Espacio', icon: 'rocket_launch', image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&auto=format' },
    { id: 'castle', label: 'Castillo', icon: 'fort', image: 'https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?w=400&auto=format' },
    { id: 'sea', label: 'Bajo el Mar', icon: 'sailing', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&auto=format' }
  ];

  const missionOptions: ScanOption[] = [
    { id: 'rescue', label: 'Rescatar a alguien', icon: 'medical_services' },
    { id: 'adventure', label: 'Aventura', icon: 'explore' },
    { id: 'time', label: 'Viaje en el tiempo', icon: 'history' },
    { id: 'save', label: 'Salvar al mundo', icon: 'public' }
  ];

  const styleOptions: ScanOption[] = [
    { id: 'cartoon', label: 'Dibujos Animados', icon: 'movie_filter' },
    { id: 'watercolor', label: 'Acuarela', icon: 'palette' },
    { id: 'pixel', label: 'Pixel Art', icon: 'grid_view' },
    { id: '3d', label: '3D', icon: 'view_in_ar' }
  ];

  const resultOptions: ScanOption[] = [
    { id: 'pdf', label: 'Descargar PDF', icon: 'picture_as_pdf' },
    { id: 'epub', label: 'Descargar EPUB', icon: 'menu_book' },
    { id: 'redo', label: 'Volver a generar', icon: 'refresh' },
    { id: 'home', label: 'Regresar al Menú', icon: 'home' }
  ];

  const itemOptions: ScanOption[] = [
    { id: 'read', label: 'Leer', icon: 'chrome_reader_mode' },
    { id: 'dedicate', label: 'Dedicar', icon: 'favorite' },
    { id: 'back', label: 'Regresar', icon: 'arrow_back' }
  ];

  const recipientOptions: ScanOption[] = [
    { id: 'papa', label: 'Papá', icon: 'person' },
    { id: 'mama', label: 'Mamá', icon: 'person_3' },
    { id: 'profe', label: 'Maestra', icon: 'school' },
    { id: 'tia', label: 'Tía', icon: 'person_2' }
  ];

  const reasonOptions: ScanOption[] = [
    { id: 'bday', label: 'Cumpleaños', icon: 'cake' },
    { id: 'thanks', label: 'Agradecimiento', icon: 'sentiment_very_satisfied' },
    { id: 'love', label: 'Cariño', icon: 'favorite' },
    { id: 'congrats', label: 'Felicitaciones', icon: 'celebration' }
  ];

  const positionOptions: ScanOption[] = [
    { id: 'start', label: 'Al Inicio', icon: 'vertical_align_top' },
    { id: 'end', label: 'Al Final', icon: 'vertical_align_bottom' }
  ];

  // --- Handlers ---
  const handleProfileSelect = (opt: ScanOption) => {
    setActiveUser(opt.label);
    setStep(AppStep.MENU);
  };

  const handleMenuSelect = (opt: ScanOption) => {
    if (opt.id === 'library') {
      setStep(AppStep.LIBRARY);
    } else {
      setConfig(prev => ({ ...prev, type: opt.id as any }));
      setStep(AppStep.SELECT_PROTAGONIST);
    }
  };

  const handleProtagonistSelect = (opt: ScanOption) => {
    setConfig(prev => ({ ...prev, protagonist: opt.label }));
    setStep(AppStep.SELECT_SCENERY);
  };

  const handleScenerySelect = (opt: ScanOption) => {
    setConfig(prev => ({ ...prev, scenery: opt.label }));
    setStep(AppStep.SELECT_MISSION);
  };

  const handleMissionSelect = (opt: ScanOption) => {
    setConfig(prev => ({ ...prev, mission: opt.label }));
    setStep(AppStep.SELECT_STYLE);
  };

  const handleStyleSelect = (opt: ScanOption) => {
    setConfig(prev => ({ ...prev, style: opt.label }));
    setStep(AppStep.GENERATING);
  };

  const handleResultAction = (opt: ScanOption) => {
    if (opt.id === 'home') resetToMenu();
    if (opt.id === 'redo') setStep(AppStep.GENERATING);
    if (opt.id === 'pdf' || opt.id === 'epub') {
        alert(`Iniciando descarga de ${opt.label}...`);
    }
  };

  const handleLibraryItemSelect = (opt: ScanOption) => {
    const item = library.find(i => i.id === opt.id);
    if (item) {
        setSelectedLibraryItem(item);
        setStep(AppStep.LIBRARY_ITEM_OPTIONS);
    }
  };

  const handleItemOptionSelect = (opt: ScanOption) => {
    if (opt.id === 'read') setStep(AppStep.READ_STORY);
    if (opt.id === 'dedicate') setStep(AppStep.DEDICATE_RECIPIENT);
    if (opt.id === 'back') setStep(AppStep.LIBRARY);
  };

  const resetToMenu = () => {
    setStep(AppStep.MENU);
    setConfig({ protagonist: '', scenery: '', mission: '', style: '', type: 'story' });
    setSelectedLibraryItem(null);
  };

  // --- AI Logic ---
  useEffect(() => {
    if (step === AppStep.GENERATING) {
      const create = async () => {
        try {
          const content = await generateStoryContent(config.protagonist, config.scenery, config.mission, config.style);
          const imageUrl = await generateStoryImage(config.protagonist, config.scenery, config.mission, config.style);
          const newStory: StoryConfig = {
            ...config,
            id: Date.now().toString(),
            title: `${config.protagonist} en ${config.scenery}`,
            content,
            imageUrl,
            date: new Date().toLocaleDateString()
          };
          setLibrary(prev => [newStory, ...prev]);
          setConfig(newStory);
          setStep(AppStep.RESULT_VIEW);
        } catch (e) {
          console.error(e);
          setStep(AppStep.RESULT_VIEW);
        }
      };
      create();
    }
  }, [step]);

  // --- Helper Component for Library Options ---
  const libraryOptions = useMemo(() => {
    return library.map(item => ({
      id: item.id!,
      label: item.title || 'Sin Título',
      icon: item.type === 'story' ? 'auto_stories' : 'brush',
      description: item.date
    }));
  }, [library]);

  return (
    <div className="min-h-screen flex flex-col bg-background-dark text-white font-display">
      {/* Header Dinámico */}
      <header className="flex items-center justify-between px-10 py-6 bg-surface-dark/50 border-b border-border-accent">
        <div className="flex items-center gap-4">
          <div className="size-10 bg-primary/20 text-primary flex items-center justify-center rounded-xl">
             <span className="material-symbols-outlined text-2xl">rocket</span>
          </div>
          <h1 className="text-2xl font-black tracking-tighter">FUTURAR</h1>
        </div>
        {activeUser && (
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/10">
               <span className="material-symbols-outlined text-primary">person</span>
               <span className="text-sm font-bold uppercase tracking-widest">{activeUser}</span>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 w-full max-w-[1440px] mx-auto overflow-y-auto">
        
        {/* Step: Profile */}
        {step === AppStep.PROFILE && (
          <div className="w-full max-w-4xl text-center">
            <h2 className="text-5xl md:text-7xl font-black mb-16 tracking-tight">¿Quién eres hoy?</h2>
            <ScanningGrid options={profileOptions} onSelect={handleProfileSelect} columns={3} scanInterval={3000} />
          </div>
        )}

        {/* Step: Main Menu */}
        {step === AppStep.MENU && (
          <div className="w-full max-w-5xl text-center">
            <h2 className="text-4xl md:text-6xl font-black mb-16 tracking-tight">¿Qué quieres hacer hoy?</h2>
            <ScanningGrid options={mainActions} onSelect={handleMenuSelect} columns={3} scanInterval={3000} />
          </div>
        )}

        {/* Story Flow Steps */}
        {step === AppStep.SELECT_PROTAGONIST && (
          <div className="w-full">
            <h2 className="text-4xl font-black mb-10 text-center">Paso 1: Elige a tu Protagonista</h2>
            <ScanningGrid options={protagonistOptions} onSelect={handleProtagonistSelect} columns={2} />
          </div>
        )}

        {step === AppStep.SELECT_SCENERY && (
          <div className="w-full">
            <h2 className="text-4xl font-black mb-10 text-center">Paso 2: Elige el Escenario</h2>
            <ScanningGrid options={sceneryOptions} onSelect={handleScenerySelect} columns={2} />
          </div>
        )}

        {step === AppStep.SELECT_MISSION && (
          <div className="w-full">
            <h2 className="text-4xl font-black mb-10 text-center">Paso 3: Elige la Misión</h2>
            <ScanningGrid options={missionOptions} onSelect={handleMissionSelect} columns={2} />
          </div>
        )}

        {step === AppStep.SELECT_STYLE && (
          <div className="w-full">
            <h2 className="text-4xl font-black mb-10 text-center">Paso 4: Elige el Estilo Visual</h2>
            <ScanningGrid options={styleOptions} onSelect={handleStyleSelect} columns={2} />
          </div>
        )}

        {/* Generating AI Screen */}
        {step === AppStep.GENERATING && (
          <div className="flex flex-col items-center text-center">
             <div className="relative size-48 md:size-64 mb-12">
                <div className="absolute inset-0 border-8 border-primary/20 rounded-full"></div>
                <div className="absolute inset-0 border-8 border-primary border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                   <span className="material-symbols-outlined text-7xl text-primary animate-pulse">auto_fix</span>
                </div>
             </div>
             <h2 className="text-4xl md:text-5xl font-black mb-4">La IA está creando tu historia...</h2>
             <p className="text-xl text-gray-400">Estamos dibujando y escribiendo tu aventura personalizada.</p>
          </div>
        )}

        {/* Final Result / Viewer */}
        {step === AppStep.RESULT_VIEW && (
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
             <div className="rounded-[3rem] overflow-hidden border-8 border-border-accent shadow-2xl aspect-video bg-surface-dark">
                <img src={config.imageUrl} className="w-full h-full object-cover" alt="Generación" />
             </div>
             <div className="flex flex-col h-full justify-between gap-8">
                <div className="bg-surface-dark/80 p-8 rounded-[2.5rem] border border-border-accent flex-1">
                   <h3 className="text-3xl font-black mb-6 text-primary">{config.title}</h3>
                   <p className="text-2xl font-medium leading-relaxed opacity-90">{config.content}</p>
                </div>
                <ScanningGrid options={resultOptions} onSelect={handleResultAction} columns={2} scanInterval={3500} />
             </div>
          </div>
        )}

        {/* Library System */}
        {step === AppStep.LIBRARY && (
           <div className="w-full max-w-6xl">
              <h2 className="text-4xl font-black mb-12 text-center">Mi Biblioteca</h2>
              {library.length > 0 ? (
                <ScanningGrid options={libraryOptions} onSelect={handleLibraryItemSelect} columns={2} />
              ) : (
                <div className="flex flex-col items-center gap-8 py-20 bg-surface-dark/30 rounded-[3rem] border-2 border-dashed border-border-accent">
                   <span className="material-symbols-outlined text-8xl opacity-20">folder_off</span>
                   <p className="text-2xl font-bold opacity-40 italic text-center">No has creado historias todavía</p>
                   <button onClick={resetToMenu} className="px-10 h-16 bg-primary rounded-2xl font-black text-xl hover:scale-105 transition-all">Empezar ahora</button>
                </div>
              )}
              {library.length > 0 && (
                <div className="mt-12 max-w-xs mx-auto">
                    <ScanningGrid columns={1} options={[{id: 'back', label: 'Volver', icon: 'arrow_back'}]} onSelect={resetToMenu} />
                </div>
              )}
           </div>
        )}

        {step === AppStep.LIBRARY_ITEM_OPTIONS && selectedLibraryItem && (
           <div className="w-full max-w-4xl text-center">
              <div className="mb-12 flex flex-col items-center">
                  <img src={selectedLibraryItem.imageUrl} className="size-48 rounded-full object-cover border-4 border-primary mb-6 shadow-xl" alt="Preview" />
                  <h2 className="text-4xl font-black">{selectedLibraryItem.title}</h2>
              </div>
              <ScanningGrid options={itemOptions} onSelect={handleItemOptionSelect} columns={3} />
           </div>
        )}

        {step === AppStep.READ_STORY && selectedLibraryItem && (
           <div className="w-full max-w-4xl flex flex-col gap-10">
              <div className="rounded-[3rem] overflow-hidden border-8 border-border-accent aspect-video">
                  <img src={selectedLibraryItem.imageUrl} className="w-full h-full object-cover" />
              </div>
              <div className="bg-white text-black p-12 rounded-[3rem] shadow-2xl relative">
                  <span className="material-symbols-outlined absolute -top-6 left-12 text-6xl text-primary">format_quote</span>
                  <p className="text-3xl font-bold leading-relaxed italic">{selectedLibraryItem.content}</p>
              </div>
              <div className="max-w-xs mx-auto w-full">
                <ScanningGrid columns={1} options={[{id: 'back', label: 'Cerrar', icon: 'close'}]} onSelect={() => setStep(AppStep.LIBRARY_ITEM_OPTIONS)} />
              </div>
           </div>
        )}

        {/* Dedication Flow */}
        {step === AppStep.DEDICATE_RECIPIENT && (
           <div className="w-full">
              <h2 className="text-4xl font-black mb-10 text-center">¿A quién se lo quieres dedicar?</h2>
              <ScanningGrid options={recipientOptions} onSelect={(o) => { setDedication(d => ({ ...d, to: o.label })); setStep(AppStep.DEDICATE_REASON); }} columns={2} />
           </div>
        )}

        {step === AppStep.DEDICATE_REASON && (
           <div className="w-full">
              <h2 className="text-4xl font-black mb-10 text-center">¿Cuál es el motivo?</h2>
              <ScanningGrid options={reasonOptions} onSelect={(o) => { setDedication(d => ({ ...d, reason: o.label })); setStep(AppStep.DEDICATE_POSITION); }} columns={2} />
           </div>
        )}

        {step === AppStep.DEDICATE_POSITION && (
           <div className="w-full">
              <h2 className="text-4xl font-black mb-10 text-center">¿Dónde quieres la dedicatoria?</h2>
              <ScanningGrid options={positionOptions} onSelect={(o) => { 
                setDedication(d => ({ ...d, position: o.id as any })); 
                alert(`¡Historia dedicada a ${dedication.to} por ${dedication.reason}!`);
                setStep(AppStep.LIBRARY_ITEM_OPTIONS);
              }} columns={2} />
           </div>
        )}

      </main>

      {/* Footer Info */}
      <footer className="w-full border-t border-border-accent bg-surface-dark py-6 px-10">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between text-gray-400">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">sensors</span>
            <span className="text-sm font-bold uppercase tracking-widest animate-pulse">Buscando pulsación...</span>
          </div>
          <div className="text-xs font-black uppercase tracking-[0.3em] opacity-30">
            © 2025 Futurar Universal Access
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
