# EN 301 549 applicability — Futurar

Date: 2026-09-30 · Scope: web application accessibility requirements.

## Applicability
EN 301 549 is the European harmonised standard for ICT accessibility, used in
EU public-sector procurement. Futurar is not currently procured in the EU, so
the standard is **not contractually required** today. It is used as a reference
because its web clauses (clause 9) normatively reference WCAG 2.1 AA (EN 301 549
v3.2.1), and our internal target (WCAG 2.2 AA) is a superset.

## Mapping
| EN 301 549 clause | Reference | Futurar status |
|---|---|---|
| 9.1.1.1 Non-text content | WCAG 2.1 1.1.1 | Pass (audit). |
| 9.1.3.1 Info and relationships | WCAG 1.3.1 | Pass (headings, roles, labels). |
| 9.1.4.3 Contrast (minimum) | WCAG 1.4.3 | Pass (`utils/contrast` tests). |
| 9.1.4.4 Resize text | WCAG 1.4.4 | Pass (16/19/22 px profile setting). |
| 9.2.1.1 Keyboard | WCAG 2.1.1 | Pass (scan/switch/keyboard). |
| 9.2.2.1 Timing adjustable | WCAG 2.2.1 | Pass (scan speed and break mode). |
| 9.2.4.7 Focus visible | WCAG 2.4.7 | Pass (`:focus-visible`). |
| 9.5.7 Dragging movements | WCAG 2.5.7 | N/A. |
| 9.6.1 Status messages | WCAG 4.1.3 | Pass (role=status + TTS). |
| 11 Software | — | N/A (web only). |
| 12 Documentation/support | — | Pending: public documentation (SPEC-025). |

## Notes
- Argentina: IRAM/ISO references and Ley 26.653 (accesibilidad web) apply to
  public bodies; the same WCAG 2.2 AA target covers them.
- Re-run this assessment if Futurar enters EU procurement or a public bid.
