# SPEC-022 — Contacts per profile, dedications and favorites for backend books

- Status: **implemented** (2026-10-01; pending owner: apply migration 0006)
- Phase: 6 / EPIC 6.3
- Depends on: SPEC-021 (profiles API), SPEC-008 (book persistence), SPEC-009 (reader/library)
- Blocks: SPEC-023 (options CRUD), SPEC-027 (analytics)

## Objective
Let each profile own a list of contacts (family/friends) and let the reader
attach a dedication to a book (to whom, why, start/end) using those contacts,
persisted in the backend and shown by the reader and the PDF. Close the
favorites debt deferred by SPEC-009 for backend books.

## Current state
- Backend books: `book_versions.dedication` stores only the **generated** text;
  the generation request accepts `dedication {to, reason, position}` but those
  params are not persisted; `BookDetailPayload.dedication` maps to `stories.
  dedication_to` in the library mapper. No endpoint updates a book after save.
- Legacy `stories` have `dedication_to/reason/position` + `is_favorite`, but
  `updateStoryDedication`/`toggleStoryFavorite` are dead code (no UI calls).
- `StoryDetails` has a PDF modal (text + position) that starts empty even when
  the book already has a generated dedication. `StoryReader` has no dedication
  UI. `StudentLibrary` merges backend + legacy with no favorite filter.
- SPEC-009 D4: "for backend books, dedication/favorites CRUD stays on legacy
  stories until SPEC-022" (this spec).

## Decisions to confirm
- **D1 Contacts model (recommended)**: new table `profile_contacts` (migration
  `0006`): `id`, `profile_id` FK `students(id) on delete cascade`, `name`,
  `relationship` (text, e.g. "mamá"), `dedication_reason` (text, optional
  default reason), timestamps. 1:N — each contact belongs to one profile.
  Alternative: teacher-level contacts + M:N assignment to profiles (more
  complex, no current need).
- **D2 Contacts backend (recommended)**: contacts live inside `ProfilesModule`
  (`contacts.repository.ts` port + in-memory + Supabase, `contacts.service.ts`,
  `contacts.controller.ts`), scoped by the JWT teacher via the profile owner:
  - `GET /api/v1/profiles/:profileId/contacts`
  - `POST /api/v1/profiles/:profileId/contacts`
  - `PATCH /api/v1/contacts/:contactId`
  - `DELETE /api/v1/contacts/:contactId` (hard delete; contacts carry no books)
  Alternative: nest routes in `ProfilesController` (smaller, less separation).
- **D3 Dedication persistence (recommended)**: migration `0006` adds
  `dedication_to`, `dedication_reason`, `dedication_position` (`start|end`) to
  `books` (book-level metadata, survives new versions) and
  `PUT /api/v1/books/:id/dedication` updates them; `BookDetailDto`/`BookSummary
  Dto` expose `dedicationTo/Reason/Position`. Generation with dedication params
  also writes them on save. `book_versions.dedication` keeps the generated text.
  Alternative: store on `book_versions` (resets per version).
- **D4 Reader/editor UI (recommended)**: `StoryReader` gains a "Dedicatoria"
  action that opens an accessible modal (dialog trap + scanning): pick a
  contact (or free text), optional reason (prefilled from the contact), position
  start/end; saves via `PUT` and renders the dedication page at start/end.
  `StoryDetails` PDF modal prefills from the saved dedication. `StudentEditor`
  gains a "Contactos" tab (add/edit/delete) backed by `services/backendContacts.
  ts`. Legacy stories keep their current local-PDF behavior.
- **D5 Favorites (recommended)**: same migration adds `is_favorite boolean not
  null default false` to `books`; `PUT /api/v1/books/:id/favorite` body
  `{isFavorite}`; library and reader expose a favorite toggle/filter. Alternative:
  defer favorites to a chore spec.
- **D6 Dead code (recommended)**: remove unused `updateStoryDedication` /
  `toggleStoryFavorite` from `services/supabase.ts`; legacy dedication/favorites
  stay read-only.

## Contracts
```ts
interface ProfileContactRepository {
  list(profileId: string): Promise<ProfileContact[]>;
  findById(contactId: string): Promise<ProfileContact | undefined>;
  create(profileId: string, input: CreateContactInput): Promise<ProfileContact>;
  update(contactId: string, patch: UpdateContactInput): Promise<ProfileContact | undefined>;
  remove(contactId: string): Promise<boolean>;
}
```
- Contacts endpoints require auth; the teacher must own the profile
  (`findById(profileId, teacherId)`), otherwise 404.
- `POST/PATCH` validate `name` (1..80), `relationship` (1..40),
  `dedicationReason` (0..200); unknown keys rejected by the global pipe.
- `PUT /books/:id/dedication` validates `to` (1..80), `reason` (0..200),
  `position` in `start|end`; ownership is the same as `GET /books/:id`.
- `PUT /books/:id/favorite` validates boolean; returns the updated summary.

## File impact
- Backend new: `supabase/migrations/0006_contacts_dedication.sql`;
  `src/profiles/{contacts.repository.ts, in-memory-contacts.repository.ts,
  supabase-contacts.repository.ts, contacts.service.ts, contacts.controller.ts,
  dto/contact.dto.ts}` + specs; update `profiles.module.ts`.
- Backend update: `book.repository.ts`, `in-memory-book.repository.ts`,
  `supabase-book.repository.ts`, `books.service.ts`, `books.controller.ts`,
  `dto/book.dto.ts`, `book-persistence.service.ts` (persist dedication params) +
  specs.
- Frontend new: `services/backendContacts.ts` + test.
- Frontend update: `services/backendBooks.ts` (dedication/favorite calls),
  `services/bookTypes.ts`, `services/bookMappers.ts`, `components/StoryReader.
  tsx`, `components/StoryDetails.tsx`, `components/StudentEditor.tsx`,
  `components/StudentLibrary.tsx`, `utils/messages.ts`, `test/msw/handlers.ts`,
  `e2e/helpers/mockBackend.ts`; delete dead code in `services/supabase.ts`.
- Docs: SPEC-022 status, `plan.md` EPIC 6.3, `MEMORY.md`.

## Acceptance criteria
1. Teacher can CRUD contacts per profile; contacts are invisible to other
   teachers (404) and cascade-delete with the profile.
2. Reader can set/clear a dedication (contact or free text + reason + position);
   it persists, survives reloads and shows at the chosen position.
3. PDF export of a backend book includes the saved dedication without retyping.
4. Generation with dedication params persists to/reason/position.
5. Backend books can be favorited/unfavorited and the library can filter them.
6. Legacy stories remain read-only; no direct Supabase imports added.
7. All suites, coverage floor, E2E and CI green.

## Edge cases
Profile with no contacts; deleted contact referenced by an old dedication (text
stays, contact id not stored); clearing a dedication; dedication longer than
200 chars; position changes after reading; legacy story without dedication;
book of another teacher; inactive profile; concurrent version generation while
editing dedication (book-level metadata).

## Out of scope
Options CRUD (SPEC-023), analytics (SPEC-027), paginated reader, legacy story
writes, multi-foundation contacts, contact photos.

## Verification
Backend `build/lint/test/e2e`; frontend `test/test:coverage/test:e2e/typecheck/
build/check:supabase`; manual: create contacts, dedicate a backend book, reload,
export PDF, favorite and filter.

## Implementation notes (2026-10-01)
- Backend: `profile_contacts` (migration `0006`) with ContactsService/Controller
  inside `ProfilesModule`; `books.dedication_to/reason/position` + `is_favorite`
  with `PUT/DELETE /books/:id/dedication` and `PUT /books/:id/favorite`;
  generation persists the requested dedication; `BookDetailDto` exposes
  `isFavorite` too. 222 tests / 44 suites.
- Frontend: `services/backendContacts.ts`; `backendBooks` dedication/favorite
  calls; reader modal (contacts chips + free text + position + clear), favorite
  action and dedication shown at start/end; PDF modal prefills the saved
  dedication; editor "Contactos" tab; library favorites filter; dead
  `updateStoryDedication`/`toggleStoryFavorite` removed. 101 tests / 21 files;
  coverage 47.8/46.5/44.7/50.1; E2E 11 passed / 1 skip.
- Deviation: legacy `stories` stay read-only (no dedication/favorite writes);
  the reader modal is not driven by the scanning grid yet (buttons + trap only).
