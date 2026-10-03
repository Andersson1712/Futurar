# Futurar

**Creación accesible, asistida por IA, de productos digitales para personas con
discapacidad motriz severa.** Los libros son el primer vertical; luego vienen
diseños y presentaciones. El barrido con un único pulsador es el centro del
producto, no una función opcional.

[English](README.md) · [Español](README.es.md)

> Última revisión: 2026-10-01 · Fuente de verdad: [`AGENTS.md`](AGENTS.md) ·
> [`plan.md`](plan.md) · [`MEMORY.md`](MEMORY.md)

## Por qué

Futurar permite crear, guardar, leer y dedicar cuentos propios usando un único
pulsador (barrido) o entrada directa. Todo está pensado para funcionar con un
solo accionador, cumplir **WCAG 2.2 AA** y seguir la guía **ISO/IEC 17549-3**
para operación por único pulsador.

## Las reglas que dan forma al código

- **La IA nunca corre en el frontend.** Sin SDK de IA, sin claves ni prompts en
  el navegador. Toda la IA pasa por el backend NestJS, que es dueño de claves,
  prompts, modelos, cuotas, validación, persistencia y auditoría.
- **El backend es dueño de los datos.** El frontend usa Supabase **solo para
  Auth** (login/refresh) y llama al backend para todo lo demás.
- **La accesibilidad no se negocia.** Un clic directo siempre gana al foco del
  barrido (`pointerdown`); nunca se toma la entrada al soltar; objetivos >= 44x44
  px; el scroll nunca se bloquea.
- **La UI es es-AR; el código, comentarios, identificadores y commits son en
  inglés** (Conventional Commits).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript 5.8 + Vite 6 (dev en `:3000`) |
| Backend | NestJS 12 + TypeScript 6 (API en `:3001`, Node >= 20.19) |
| Datos / Auth | Supabase (Postgres + Auth); el backend es el único dueño de datos |
| IA | Gemini, alcanzado **solo** a través del backend |
| Tests | Vitest + Testing Library + MSW + Playwright (frontend); Jest (backend) |

## Estructura del repositorio

```
.                 Frontend: components/ contexts/ hooks/ services/ utils/ types.ts
backend/          API Nest: src/ai (proveedores), src/{actions,profiles,books,admin,jobs}
backend/supabase/ Migraciones SQL (aplicar en orden, 0001 -> 0008)
docs/             specs/ (SDD), accessibility/, security/, adr/, guides/, architecture/
scripts/          Herramientas del repo (guarda de Supabase, gobernanza GitHub)
e2e/              Specs end-to-end de Playwright y helpers
```

## Primeros pasos

**Requisitos:** Node.js >= 20.19.

```bash
# 1. Frontend (raíz del repo)
npm install
cp .env.example .env            # variables del frontend (solo Auth)
npm run dev                     # http://localhost:3000

# 2. Backend
cd backend
npm install
cp .env.example .env            # variables del backend (las claves de IA van acá)
npm run start:dev               # http://localhost:3001
```

Aplicá las migraciones SQL de `backend/supabase/migrations/` (en orden) en tu
proyecto Supabase. Los endpoints de IA quedan apagados hasta poner
`AI_ENDPOINTS_ENABLED=true` y configurar las variables requeridas del backend.

## Entorno y secretos

- **Frontend** (`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_API_URL`. Solo Auth — **nunca** pongas una clave de IA acá.
- **Backend** (`backend/.env`): `PORT`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
  `GEMINI_API_KEY`, `AI_ENDPOINTS_ENABLED`, `QUEUE_DRIVER`, `LOG_LEVEL` y las variables
  opcionales de credenciales/cola/imágenes. Ver `backend/.env.example` para la
  lista completa y documentada.
- Nunca commitees `.env*` ni secretos. Ver [`SECURITY.md`](SECURITY.md).

## Observabilidad

- Logs JSON estructurados con correlation id de punta a punta (se respeta
  `x-correlation-id`, si no llega se genera UUID, se devuelve en cada
  respuesta y las credenciales se redactan).
- `GET /api/v1/health` es público (liveness, degradado en vez de caerse);
  `GET /api/v1/metrics` exige auth docente (contadores en memoria, se reinician).
- `GET /api/v1/profiles/active` es público (entrada del quiosco, sin notas del docente).
- Umbrales de alerta sugeridos: [`docs/ops/alerts.md`](docs/ops/alerts.md).

## Comandos

Frontend (raíz del repo):

| Comando | Para qué |
|---|---|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` | Build de producción |
| `npm run typecheck` | Chequeo de TypeScript (`tsc --noEmit`) |
| `npm test` | Tests unitarios/componentes (Vitest) |
| `npm run test:coverage` | Tests con piso de cobertura |
| `npm run test:e2e` | End-to-end con Playwright |
| `npm run check:supabase` | Bloquea imports directos nuevos de Supabase |

Backend (`backend/`):

| Comando | Para qué |
|---|---|
| `npm run start:dev` | Servidor Nest con watch |
| `npm run build` | Compila la API |
| `npm run lint` | ESLint |
| `npm test` | Tests unitarios con Jest |
| `npm run test:e2e` | Tests e2e con Jest |

## Accesibilidad

Futurar apunta a **WCAG 2.2 AA**, **ISO/IEC 17549-3** (único pulsador) y
**EN 301 549** donde aplique. Ver la
[declaración de accesibilidad](docs/accessibility/declaration.es.md) y la
[guía de implementación/verificación](docs/accessibility/guide.es.md). La
auditoría técnica está en
[`docs/accessibility/audit-wcag-2.2.md`](docs/accessibility/audit-wcag-2.2.md).

## Documentación

- [Visión de arquitectura](docs/architecture/overview.md)
- [ADRs](docs/adr/README.md)
- [Guía de i18n](docs/i18n.md)
- [Guías de usuario](docs/guides/): [docente](docs/guides/docente.es.md) ·
  [estudiante](docs/guides/estudiante.es.md)
- [Specs (SDD)](docs/specs/) y el [plan de ejecución](plan.md)

## Contribuir

Leé [`CONTRIBUTING.md`](CONTRIBUTING.md) y [`AGENTS.md`](AGENTS.md) antes de
abrir un PR. El proyecto sigue desarrollo guiado por especificación: no hay
código sin un spec aprobado.

## Seguridad

Reportá vulnerabilidades de forma privada — ver [`SECURITY.md`](SECURITY.md).

## Código de conducta

Este proyecto sigue el [Contributor Covenant](CODE_OF_CONDUCT.md).

## Licencia

A definir (ver SPEC-026). Hasta que se agregue una licencia, todos los derechos
están reservados.
