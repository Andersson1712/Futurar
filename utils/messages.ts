/**
 * Temporary centralized UI copy (es-AR).
 * TODO(SPEC-018): replace with the real i18n layer and translation keys.
 */

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
