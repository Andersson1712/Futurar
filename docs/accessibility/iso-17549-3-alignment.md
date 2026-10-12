# ISO/IEC 17549-3 alignment — single-switch scanning

Date: 2026-09-30 · Scope: scanning interaction across the student flow.

ISO/IEC 17549-3:2021 provides guidelines for the design and operation of
single-switch accessible systems. This document maps the guidelines to the
implemented behaviour.

| Guideline area | Implementation |
|---|---|
| Sequential focus presentation | `ScanningGrid` advances focus automatically at the profile speed (0.8–5 s) or manually with arrows/Tab. |
| Switch activation | Space/Enter and WebHID input activate the focused element (`useInputDevice`); `pointerdown` activation is separate. |
| Direct selection wins | Pressing an option selects the pressed element immediately on `pointerdown`, cancelling the scan timer (SPEC-011). |
| No release-activation | Selection never occurs on release; the global fallback also listens on `pointerdown`. |
| Configurable timing | Scan speed and sweep on/off are per profile; large targets (≥44 px) reduce timing pressure (SPEC-015). |
| No timing traps | Scanning pauses on demand (break mode), while dialogs are open and while a selection is in flight; autosave resumes progress (SPEC-014). |
| Feedback | Visual focus, spoken option labels, optional selection sound and progress bar. |
| Modes | `input_mode` per profile: scan, switch, mouse, touch; mouse/touch never auto-advance. |
| Error recovery | Errors are announced and the wizard keeps state for retry; no destructive timeouts. |

## Known gaps
- Scanning inside every modal uses the dialog trap (Tab-based) rather than the
  grid scan; extending scan semantics to all dialogs is future work.
- Number of scanning steps per screen should be revalidated with real users.
