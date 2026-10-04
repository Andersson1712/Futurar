// SPEC-023C: introductory catalog for new teachers.
// Source of truth for the intro set. Content moved verbatim from the
// one-off seed script (/tmp/opencode/seed-catalog.js, applied 2026-10-03
// via service key); evolve the intro set here, not in throwaway scripts.
// Consumed by `ensureTeacherCatalog` (Supabase + in-memory repositories).

export interface IntroActionSeed {
  code: string;
  label: string;
  icon: string;
  sortOrder: number;
}

export interface IntroOptionSeed {
  code: string;
  label: string;
  icon: string;
  sortOrder: number;
}

export interface IntroItemSeed {
  optionCode: string;
  level: number;
  icon: string;
  label: string;
  sortOrder: number;
}

export const INTRO_ACTIONS: IntroActionSeed[] = [
  { code: 'create', label: 'Crear Cuento', icon: 'auto_stories', sortOrder: 1 },
  {
    code: 'library',
    label: 'Mi Biblioteca',
    icon: 'library_books',
    sortOrder: 2,
  },
  { code: 'design', label: 'Diseñar', icon: 'brush', sortOrder: 3 },
];

export const INTRO_OPTIONS: IntroOptionSeed[] = [
  { code: 'protagonist', label: 'Protagonista', icon: 'face', sortOrder: 1 },
  { code: 'scenario', label: 'Escenario', icon: 'landscape', sortOrder: 2 },
  { code: 'mission', label: 'Misión', icon: 'flag', sortOrder: 3 },
  { code: 'style', label: 'Estilo Visual', icon: 'palette', sortOrder: 4 },
];

type IntroItemRow = [
  optionCode: string,
  level: number,
  icon: string,
  labels: string[],
];

const INTRO_ITEM_ROWS: IntroItemRow[] = [
  [
    'protagonist',
    1,
    'forest',
    ['León', 'Elefante', 'Mono', 'Tigre', 'Guacamayo'],
  ],
  ['protagonist', 2, 'home', ['Perro', 'Gato', 'Conejo', 'Loro', 'Hámster']],
  [
    'protagonist',
    3,
    'castle',
    ['Dragón', 'Unicornio', 'Hada', 'Duende', 'Ogro'],
  ],
  ['protagonist', 4, 'waves', ['Ballena', 'Delfín', 'Pulpo', 'Sirena', 'Pez']],
  [
    'protagonist',
    5,
    'auto_stories',
    ['Príncipe', 'Princesa', 'Caballero', 'Mago', 'Bruja buena'],
  ],
  [
    'protagonist',
    6,
    'shield',
    ['Con capa', 'Con antifaz', 'Con súper fuerza', 'Que vuela', 'Con escudo'],
  ],
  [
    'protagonist',
    7,
    'directions_car',
    ['Autito', 'Tren', 'Avión', 'Barco', 'Camión de bomberos'],
  ],
  [
    'protagonist',
    8,
    'child_care',
    [
      'Explorador/a',
      'Niño/a en silla de ruedas con superpoderes',
      'Niño/a con superpoderes',
      'El Detective de Misterios',
    ],
  ],
  [
    'scenario',
    1,
    'park',
    [
      'Un bosque encantado',
      'El fondo del mar',
      'Una montaña de nieve',
      'Selva',
      'Granja',
    ],
  ],
  [
    'scenario',
    2,
    'location_city',
    [
      'Una escuela',
      'Un parque de diversiones',
      'Vecindario',
      'Estación de tren',
      'Casa',
      'Laberinto secreto dentro de una casa',
    ],
  ],
  [
    'scenario',
    3,
    'rocket_launch',
    [
      'Un planeta lejano',
      'El espacio exterior',
      'Otra dimensión',
      'Una ciudad escondida de la civilización',
      'Viaje al pasado o al futuro',
    ],
  ],
  [
    'scenario',
    4,
    'computer',
    ['Dentro de una computadora', 'Interior de una juguetería de noche'],
  ],
  [
    'mission',
    1,
    'search',
    [
      'El tesoro escondido',
      'La llave mágica',
      'El amigo perdido',
      'El objeto desaparecido',
    ],
  ],
  [
    'mission',
    2,
    'favorite',
    [
      'Rescatar a un animalito',
      'Reparar algo roto',
      'Llevar un mensaje importante',
      'Ayudar a un amigo',
      'Defender a personas buenas de un villano',
    ],
  ],
  [
    'mission',
    3,
    'sports_soccer',
    ['Carrera', 'Aprender algo nuevo', 'Juego de equipo'],
  ],
  [
    'mission',
    4,
    'shield',
    [
      'Defender al mundo de un villano',
      'Defender al mundo de un millonario',
      'Defender al mundo de extraterrestres',
      'Defender al mundo de robots',
    ],
  ],
  ['style', 1, 'brush', ['Dibujos animados']],
  ['style', 1, 'palette', ['Acuarela']],
  ['style', 1, 'movie', ['3D realista']],
  ['style', 1, 'grid_on', ['Pixel art']],
  ['style', 1, 'bolt', ['Cómics y superhéroes']],
  ['style', 1, 'toys', ['Plastilina']],
];

function flattenItems(rows: IntroItemRow[]): IntroItemSeed[] {
  const items: IntroItemSeed[] = [];

  for (const [optionCode, level, icon, labels] of rows) {
    labels.forEach((label, index) => {
      items.push({ optionCode, level, icon, label, sortOrder: index + 1 });
    });
  }

  return items;
}

export const INTRO_ITEMS: IntroItemSeed[] = flattenItems(INTRO_ITEM_ROWS);
