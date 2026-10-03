# Guía de accesibilidad

> Última revisión: 2026-10-01 · Estado auto-evaluado (WCAG 2.2 AA). Pendiente
> validación con personas usuarias y tecnologías de asistencia reales.

La accesibilidad es un requisito del producto, no una función opcional. Futurar
apunta a **WCAG 2.2 AA**, **ISO/IEC 17549-3** (operación por único pulsador) y
**EN 301 549** donde aplique.

Documentos relacionados:

- [Declaración de accesibilidad](declaration.es.md)
- [Auditoría WCAG 2.2](audit-wcag-2.2.md)
- [Alineación ISO/IEC 17549-3](iso-17549-3-alignment.md)
- [Aplicabilidad EN 301 549](en-301-549-applicability.md)

## Principios de interacción

1. **Un solo accionador.** Todo el recorrido funciona con barrido automático:
   `ScanningGrid` avanza el foco y `useInputDevice` lo activa con Espacio, Enter
   o un pulsador HID.
2. **El clic directo gana al foco del barrido.** La selección se toma en
   `pointerdown` sobre `[data-option]`; **nunca** al soltar (`pointerup`).
3. **Entrada configurable por perfil.** Modos barrido/pulsador/mouse/táctil y
   velocidad de barrido (0,8–5 s) persistidos en `student_settings`.
4. **Paginación del barrido.** Las opciones se agrupan por nivel y se navegan con
   un objetivo "Más opciones" (SPEC-023B), para no saturar la pantalla.

## Requisitos de UI

- Objetivos interactivos **>= 44×44 px**.
- Contraste de texto **>= 4.5:1**; de foco/UI **>= 3:1**; foco **siempre visible**
  (`:focus-visible`).
- Sin `div`/`span` usados como botón; todo control tiene nombre accesible
  (`aria-label`).
- Se respeta `prefers-reduced-motion` y `prefers-contrast`.
- **El scroll nunca se bloquea**: `overflow-x` únicamente, `touch-action: pan-y`,
  `100dvh`.

## Ajustes por perfil

Persistidos en backend (`student_settings`, migración 0003) y aplicados en
`<html>`/contextos: tamaño de letra 16/19/22, interlineado, negrita en títulos,
mayúsculas, voz (es-AR con respaldo es-US) y módulos habilitados.

## Cómo se verifica

- **axe-core** dentro de Vitest sobre pantallas clave (`components/a11y.test.tsx`).
  jsdom no calcula color, por eso el contraste se valida aparte.
- **Contraste** con `utils/contrast.test.ts` (luminancia relativa y ratio WCAG
  sobre la paleta real).
- **Interacción** (clic gana al foco, focus trap, autoguardado, scroll) en las
  suites SPEC-011/012/013/014/015/018 y en E2E con Playwright.
- **Diálogos**: `useDialogA11y` (focus trap + `isModalOpen` pausa los grids).

## Al agregar una función

Incluí el checklist de accesibilidad de [`CONTRIBUTING.md`](../../CONTRIBUTING.md):
un solo switch, `pointerdown`, objetivos 44 px, contraste, foco, motion, scroll y
nombres accesibles. Sin tests de accesibilidad no se mergea.
