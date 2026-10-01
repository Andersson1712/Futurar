# Declaración de Accesibilidad de Futurar

Fecha de emisión: 30 de septiembre de 2026 · Versión: 1.0

## Compromiso
Futurar es una plataforma pensada para que personas con discapacidad motriz
severa puedan crear, guardar, leer y dedicar cuentos usando un único pulsador
(barrido) o entrada directa. La accesibilidad es un requisito central del
producto, no una función opcional.

## Estado de conformidad
El recorrido del estudiante se alinea con **WCAG 2.2 nivel AA** y con las guías
de operación por único pulsador de **ISO/IEC 17549-3**. La auditoría técnica y
los criterios evaluados están en:

- `docs/accessibility/audit-wcag-2.2.md`
- `docs/accessibility/iso-17549-3-alignment.md`
- `docs/accessibility/en-301-549-applicability.md`

## Funciones de accesibilidad disponibles
- Barrido automático con velocidad configurable por perfil (0,8 a 5 segundos) y
  opción de desactivarlo.
- Modos de entrada por perfil: barrido, pulsador (HID), mouse y táctil.
- Selección directa: tocar o hacer clic en una opción la elige al instante,
  aunque el foco del barrido esté en otra.
- Asistente de voz (TTS) con voz femenina/masculina y control de encendido.
- Tamaño de letra 16/19/22, interlineado, títulos en negrita y mayúsculas.
- Foco visible permanente, objetivos táctiles de 44×44 px o más y contraste AA.
- Respeto de `prefers-reduced-motion` y `prefers-contrast` del sistema.
- Autoguardado: al volver, el recorrido continúa donde se dejó.

## Limitaciones conocidas
- La voz **es-AR** no está disponible en la mayoría de los dispositivos; se usa
  `es-US` como respaldo hasta evaluar voces en la nube (SPEC-030).
- La generación de imágenes del cuento es opcional y puede estar desactivada.
- La declaración es un documento del repositorio; su publicación en el sitio
  público se realiza con SPEC-025.
- Falta validación con personas usuarias y tecnologías de asistencia reales.

## Contacto y comentarios
Para reportar barreras de accesibilidad, abrir un issue en el repositorio del
proyecto indicando la pantalla, el dispositivo y el modo de entrada utilizado.

## Actualizaciones
Esta declaración se revisa al cierre de cada fase del plan (`plan.md`) y cuando
cambian las funciones de accesibilidad.
