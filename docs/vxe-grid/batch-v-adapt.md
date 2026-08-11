Batch V complete.

## Report

**Context:** The previous attempt at batch V had timed out mid-implementation, leaving a near-complete working tree. I reviewed it against the baseline spec (all details verified: `getValidated()` on the core cellEdit store, beginEdit call-site routing, toggleAll pre-toggle semantics, scroll wiring), confirmed it was spec-conformant, ran the full verification suite, and finished the commit.

**Files changed** (commits `ba5615c3` + `32bd2fcd`):

| File                                                                                                         | Change                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`                                                               | +3 named param interfaces (`IrisTableEditStartParams`, `IrisTableEditClosedParams`, `IrisTableScrollParams`, exported) + 4 single-line handle entries (`loadData`/`reloadData`/`commitProxy`/`getProxyInfo`) — 451/500 lines |
| `packages/react/src/primitives/table/props.ts`                                                               | 4 single-line event props (`onEditStart`/`onEditClosed`/`onSelectAllChange`/`onScroll`) — 495/500 lines, no overflow                                                                                                         |
| `packages/react/src/primitives/table/Table.tsx`                                                              | +93: handle methods, beginEdit/cancelEdit/commitEdit event wiring, toggleAll event, non-virtual scroll listener effect + virtual handler extension                                                                           |
| `packages/react/src/primitives/table/index.ts`                                                               | 3 type re-exports                                                                                                                                                                                                            |
| `packages/react/src/primitives/table/test/proxy-methods-events.test.tsx`                                     | **new**, 272 lines, 10 tests                                                                                                                                                                                                 |
| docs (`batch-v-adapt.md`, `DECISIONS.md`, `vxe-grid-comparison.md`) + regenerated `manifest.json`/`llms.txt` |                                                                                                                                                                                                                              |

**Tests added (10):** loadData no-requery · reloadData refetch · commitProxy overrides · getProxyInfo ±proxy · onEditStart · onEditClosed commit/cancel · rejected commit silent · onSelectAllChange 3-state pre-toggle · onScroll virtual · onScroll native + cleanup.

**Counts:** react **1810/1810** tests (160 files) · typecheck 0 errors · lint **0 errors** (1 pre-existing complexity warning) · spec.py **0 violations** · manifest: react table 117→121 props, 21→25 events, +3 types; 155 components all-framework aligned, diff purely additive.

**Unfinished (documented decisions, all in type docs + comparison doc):** loadData leaves proxy total unchanged until next query (core remote source has no setData) · row-edit mode doesn't report edit events · async-validating commits not reported via onEditClosed · `autoClear` supersede-close unreachable (pre-existing).
