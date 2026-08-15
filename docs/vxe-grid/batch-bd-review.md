# Batch BD Review: **PASS** (2 non-blocking low findings)

Verdict written to `docs/vxe-grid/batch-bd-review.md`.

## What was checked

**Spec correctness** — every baseline anchor verified against code:

- `IrisTablePresenceEntry {id,name,color,cellKey}` in `types.ts` after `IrisTableVersionEntry`; `cellKey` uses the canonical `${rowKeyVal}::${colKey}` delimiter matching `cellId` (Table.tsx:2305) and `dirtyKey`/`cellNoteState` (fiat 1 ✓)
- `presence?` prop after `onAnnotationsChange` in `props.ts`, controlled-array contract documented; destructured out of `...rest` so it can't leak to the DOM root
- Rendering: `data-iris-presence="true"` + `outline: 2px solid <first.color>` + `position: relative`; labels with `-id`/`-name`, `insetInlineStart` (RTL-safe), `pointerEvents: none`, cascade `top: i*14`; module helpers (`presenceOf`/`presenceStyle`/`renderPresenceLabels`) keep the render arrow complexity flat; one Map lookup per visible cell
- **Corner budget verified free**: label top-left vs dirty dot/note badge top-right (insetInlineEnd) vs fill handle bottom
- All 9 baseline test cases present and passing; pure display — zero state/store/effect/core changes; fail-inert unknown cellKey

**Additive only** — all source diffs are pure additions (sole deletion = import-line consolidation); core untouched; no other framework touched.

**Manifest hygiene** — `check:manifest` up to date, zero drift (155×4, 86 tokens, react props 147→148 purely additive).

**Core framework-free** — zero `packages/core` diff; core suite passes untouched.

**CSS tokens** — `PRESENCE_LABEL_STYLE` fully token-driven with the codebase's established `var(--iris-*, #fff)` fallback pattern (same as Button/Chip/Calendar/Image/Result); background = entry color verbatim = disclosed fiat-4 data exception; logical properties only.

## Verification commands

| Check           | Result                                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| core test       | ✅ 1457 passed                                                                                                  |
| react test      | ✅ 2119 passed (presence.test.tsx 9/9)                                                                          |
| react typecheck | ✅ clean                                                                                                        |
| react lint      | ✅ 0 errors, 1 warning — **verified pre-existing** via stash (complexity 250 at line 1173 before vs 1223 after) |
| audit           | ✅ 0 vulnerabilities                                                                                            |
| check:manifest  | ✅ up to date                                                                                                   |

## Findings (both low, non-blocking)

1. **Label cascade overlap** — `Table.tsx:436`: `top: i*14` vs 16.8px line box → 2.8px overlap on stacked labels; cosmetic, matches documented design. Fix: `top: i * 16.8`.
2. **Duplicate-id key collision** — `Table.tsx:431`: `key={e.id}` would warn if the same id appears twice on one cell; consumer contract guarantees stable unique ids. Fix: `key={`${e.id}::${i}`}`.

No files modified (verdict markdown only).
