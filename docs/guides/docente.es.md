# Guía del docente

> Última revisión: 2026-10-01

Esta guía describe el panel docente de Futurar. El backend es dueño de los datos;
el panel usa la API (`/api/v1`) autenticada con el login del/la docente.

## Perfiles de estudiantes

- Creá un perfil con nombre, fecha de nacimiento (opcional), avatar y notas.
- El "perfil activo" reúne los ajustes de accesibilidad y las opciones habilitadas
  para ese estudiante.
- Los perfiles se desactivan por "soft delete" (`is_active=false`); no se borran
  los datos.
- Al crear un perfil, el backend siembra las acciones y opciones por defecto del
  catálogo y mantiene `modules` en espejo con `profile_actions`.

## Módulos y complejidad del cuento

- Módulos por perfil: **Crear cuentos**, **Biblioteca**, **Diseñar**.
- Complejidad del libro: tamaño (corto/mediano/largo) y audiencia
  (infantil/juvenil/adultos). Se usan como valores por defecto al generar.

## Ajustes de accesibilidad (por perfil)

- Velocidad de barrido y barrido activado/desactivado.
- Modo de entrada: barrido, pulsador (HID), mouse o táctil.
- Tamaño de letra 16/19/22, interlineado, negrita en títulos y mayúsculas.
- Voz (femenina/masculina/automática) y sonido.
- Ver la [guía de accesibilidad](../accessibility/guide.es.md) para el detalle.

## Acciones y opciones (catálogo)

El catálogo es compartido por docente: **Acción → Opción → Ítem**.

- Acciones: Crear Cuento, Mi Biblioteca, Diseñar.
- Opciones de "Crear Cuento": Protagonista, Escenario, Misión, Estilo Visual.
- Ítems: cada elemento con nombre, icono automático y **nivel** (página de
  barrido).
- En la pestaña de elementos habilitás, para cada estudiante, qué ítems usa.
- **Límites**: `max_enabled` (total habilitado por opción) y `max_per_page`
  (ítems por nivel/página). El backend los valida al guardar; si te excedés, la
  pantalla muestra un aviso de límite.
- Los ítems de nivel 1 aparecen en la primera pantalla de barrido del estudiante;
  los niveles mayores se alcanzan con el objetivo **"Más opciones"**.

## Contactos y dedicatorias

- Cargá contactos por perfil (nombre, relación, motivo de dedicatoria).
- En el lector, la dedicatoria se elige desde esos contactos y se usa también en
  el PDF.
- Los cuentos se pueden marcar como **favoritos**; la biblioteca permite filtrar.

## Credenciales de IA (opcional)

- Si tu institución usa su propia clave, se carga por docente y se guarda
  **cifrada** (AES-256-GCM) en el backend.
- La API devuelve **solo metadata** (nunca la clave completa) y permite rotarla
  sin cortar el servicio.
- La clave de entorno sigue siendo el respaldo de desarrollo.

## Biblioteca y cuentos

- La biblioteca muestra los cuentos del perfil (backend) y los cuentos heredados
  en modo lectura.
- Desde un cuento podés abrir el lector, escuchar (TTS), dedicar y marcar
  favorito.

## Recomendaciones

- Antes de dar el dispositivo al estudiante, verificá el perfil activo, la
  velocidad de barrido y la voz.
- Empezá con pocas opciones habilitadas (por ejemplo, un ítem por opción) y sumá
  a medida que el estudiante se familiariza.
