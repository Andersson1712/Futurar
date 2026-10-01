/**
 * Centralized es-AR UI copy (temporary i18n layer).
 * SPEC-018: critical shared strings live here and are read through `t()`.
 * Full i18n (namespaces, locales, panel extraction) is a follow-up spec.
 */

export const LOCALE = 'es-AR';

export const TRANSLATIONS = {
  'controls.title': 'Controles',
  'controls.toggle': 'Controles de accesibilidad',
  'controls.speed': 'Velocidad',
  'controls.speedSpoken': 'Velocidad de barrido',
  'controls.voice': 'Asistente de Voz',
  'controls.voiceOn': 'Activado',
  'controls.voiceOff': 'Desactivado',
  'controls.pause': 'Tomar un Descanso',
  'controls.pauseHint': 'Pausar todo',
  'controls.resume': 'Continuar',
  'controls.resumeHint': 'Reanudar el barrido',
  'controls.menu': 'Menú Principal',
  'controls.menuHint': 'Regresar al inicio',
  'controls.close': 'Cerrar',
  'controls.closeHint': 'Seguir en esta pantalla',

  'scan.keyboardHint': 'Presiona Espacio o Enter para seleccionar',
  'scan.gridLabel': 'Opciones',

  'wizard.menuTitle': '¿Qué quieres hacer hoy?',
  'wizard.protagonistTitle': 'Elige tu Protagonista',
  'wizard.sceneryTitle': 'Elige el Escenario',
  'wizard.missionTitle': 'Elige la Misión',
  'wizard.styleTitle': 'Elige el Estilo Visual',
  'wizard.generatingTitle': 'Creando tu historia...',
  'wizard.backToMenu': 'Volver al Menú',
  'wizard.createStory': 'Crear Cuento',
  'wizard.library': 'Mi Biblioteca',
  'wizard.design': 'Diseñar',
  'wizard.retry': 'Intentar de nuevo',

  'library.loading': 'Cargando tu biblioteca...',
  'library.emptyTitle': 'Tu biblioteca está vacía',
  'library.emptyHint': '¡Crea tu primer cuento y aparecerá aquí!',
  'library.createFirst': 'Crear mi primer cuento',
  'library.backToMenu': 'Volver al Menú',
  'library.openStory': 'Abriendo tu cuento...',

  'reader.read': 'Leer',
  'reader.save': 'Guardar',
  'reader.pdf': 'PDF',
  'reader.other': 'Otro',
  'reader.home': 'Volver al inicio',

  'login.title': 'Iniciar sesión',
  'login.signIn': 'Iniciar Sesión',
  'login.signUp': 'Crear Cuenta',
  'login.email': 'Correo electrónico',
  'login.password': 'Contraseña',

  'credentials.title': 'Clave de IA (Gemini)',
  'credentials.tab': 'Clave IA',
  'credentials.hint':
    'Se guarda cifrada en el servidor y nunca se muestra completa.',
  'credentials.loading': 'Cargando credenciales...',
  'credentials.status': 'Estado',
  'credentials.active': 'Activa',
  'credentials.hintLabel': 'Terminación',
  'credentials.updated': 'Actualizada',
  'credentials.none': 'Sin clave configurada',
  'credentials.save': 'Guardar clave',
  'credentials.rotate': 'Rotar clave',
  'credentials.revoke': 'Revocar clave',
  'credentials.placeholder': 'Pegá la API key de Gemini',
  'credentials.saved': 'Clave guardada y activa',
  'credentials.revoked': 'Clave revocada',
  'credentials.signInRequired': 'Iniciá sesión para gestionar la clave',
  'credentials.disabled':
    'La gestión de claves está deshabilitada en el servidor',

  'editor.birthdate': 'Fecha de nacimiento (opcional)',
  'editor.modules': 'Módulos habilitados',
  'editor.moduleCreate': 'Crear cuentos',
  'editor.moduleLibrary': 'Biblioteca',
  'editor.moduleDesign': 'Diseñar',
  'editor.bookComplexity': 'Complejidad del cuento',
  'editor.bookShort': 'Corto',
  'editor.bookMedium': 'Mediano',
  'editor.bookLong': 'Largo',
  'editor.bookAudience': 'Audiencia',
  'editor.audienceChild': 'Infantil',
  'editor.audienceTeen': 'Juvenil',
  'editor.audienceAdult': 'Adultos',
} as const;

export type MessageKey = keyof typeof TRANSLATIONS;

export function t(key: MessageKey): string {
  const value = TRANSLATIONS[key];

  if (!value) {
    throw new Error(`Missing translation for key: ${key}`);
  }

  return value;
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_REQUEST:
    'Algo de lo que elegiste no está permitido. Probá con otras opciones.',
  INVALID_OUTPUT:
    'La historia no se generó correctamente. Podés intentarlo otra vez.',
  CONTENT_BLOCKED:
    'La historia generada no es apropiada para esta audiencia. Probá con otras opciones.',
  RATE_LIMITED: 'Hay mucha demanda ahora. Esperá un momento y volvé a intentar.',
  PROVIDER_UNAVAILABLE:
    'El servicio de creación no está disponible en este momento. Intentá más tarde.',
  TIMEOUT: 'La creación tardó demasiado. Podés intentarlo de nuevo.',
  UNAUTHORIZED: 'Tu sesión expiró. Volvé a iniciar sesión.',
  FORBIDDEN: 'No tenés permiso para hacer esto.',
  NOT_FOUND: 'No encontramos lo que buscabas.',
  AI_ENDPOINTS_DISABLED:
    'La creación con IA está deshabilitada por ahora. Probá más tarde.',
  IDEMPOTENCY_KEY_REQUIRED:
    'Hubo un problema al enviar la solicitud. Probá de nuevo.',
  IDEMPOTENCY_KEY_REUSED:
    'La solicitud ya se había enviado. Esperá a que termine la creación.',
  NOT_IMPLEMENTED: 'Esta función estará disponible pronto.',
  VALIDATION_FAILED: 'Revisá los datos ingresados y volvé a intentar.',
  INTERNAL: 'Ocurrió un error inesperado. Podés intentarlo otra vez.',
  UNKNOWN: 'Ocurrió un error inesperado. Podés intentarlo otra vez.',
};

export const MESSAGES = {
  errors: {
    aiUnavailable:
      'La creación de cuentos con IA estará disponible nuevamente muy pronto. Mientras tanto puedes leer, escuchar y dedicar tus cuentos guardados.',
    generic: 'No pudimos crear tu cuento. Podés intentarlo otra vez.',
    network:
      'No pudimos conectar con el servidor. Revisá la conexión e intentá de nuevo.',
    libraryUnavailable:
      'No pudimos cargar tus cuentos nuevos. Podés seguir leyendo los guardados.',
  },
  generation: {
    unavailable: 'Generación con IA temporalmente deshabilitada',
    queued: 'Preparando la magia...',
    processing: 'La IA está escribiendo tu aventura única',
    completed: '¡Tu cuento está listo!',
    failed: 'No pudimos terminar el cuento',
  },
} as const;

export function messageForErrorCode(code?: string): string {
  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  return MESSAGES.errors.generic;
}
