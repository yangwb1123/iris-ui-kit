Batch BD complete — collaborative presence cursors implemented and fully verified.

## Report

**Files changed (6 + manifest, additive, react-only, core untouched):**

| File                              | Change                                                                                                                                                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                        | +`IrisTablePresenceEntry` named exported interface (`id`/`name`/`color`/`cellKey`), after `IrisTableVersionEntry`                                                                                                     |
| `props.ts`                        | +`presence?: IrisTablePresenceEntry[]` after `onAnnotationsChange`, controlled-array contract documented                                                                                                              |
| `styles.ts`                       | +`PRESENCE_LABEL_STYLE` — `--iris-*` tokens only, logical `insetInlineStart` (RTL-safe), `pointerEvents: none`                                                                                                        |
| `Table.tsx`                       | +79: destructure, `presenceByCell` render-scoped memo (group by cellKey → one Map lookup per visible cell), 3 module helpers (`presenceOf`/`presenceStyle`/`renderPresenceLabels`), cell attr + style spread + labels |
| `index.ts`                        | +`type IrisTablePresenceEntry` export                                                                                                                                                                                 |
| `presence.test.tsx`               | new — 199 lines, **9 tests**                                                                                                                                                                                          |
| `manifest.json`/`llms.txt`        | regenerated (react IrisTable props 147→148, purely additive)                                                                                                                                                          |
| `docs/vxe-grid/batch-bd-adapt.md` | new adapt report                                                                                                                                                                                                      |

**Tests added (9):** cursor outline + label, `::` delimiter, multi-cell, same-cell stacking (first-wins outline + cascade), no presence → nothing, empty array → nothing, **presence change re-renders** (spec), unknown cellKey inert, token/style assertions (incl. RTL-safe anchor, pointer-events, 2px outline).

**Semantics:** `data-iris-presence="true"` + `outline: 2px solid <first color>` + `position: relative`; corner labels carry `data-iris-presence-label` + `-id`/`-name`, cascade `top: i*14` on stacking. Pure display — zero state/store/effect/handle/i18n/core changes; new array reference re-renders (same contract as `data`/`annotations`).

**Counts/verification (all pass):**

- core test: 94 files / 1457 tests ✓
- react typecheck ✓ · react test 188 files / 2119 tests (+9) ✓ · lint **0 errors** (1 pre-existing complexity warning, 250 before → 250 after) ✓
- `iris-ui-spec.py --mode all --json` → **0 violations** ✓
- `gen:manifest` regenerated + re-run after prettier → zero drift ✓

**What is left:** nothing — all 10 baseline fiats implemented as specified (155 components × 4 frameworks was already in HEAD; `DECISIONS.md`/`batch-bc-gate.md` `M` entries are pre-existing BC-batch changes, untouched).
