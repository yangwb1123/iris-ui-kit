All done. Batch CM (列合计行粘性) is complete.

## Report — batch CM：列合计行粘性（iris 独有）

**Spec**: `summaryRowStyle?: 'default' | 'sticky'` — the global summary row `position: sticky; bottom: 0` pins to the viewport's bottom edge inside the fixed-height scroll container; tests for sticky attr presence + style. vxe has no summary sticky parity → pure iris additive, fail-closed default.

### Files changed (uncommitted, 6 source + 2 docs + manifest)

| File                                                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                                        | `summaryRowStyle?: 'default'                                                                                                                                                                                                                                                                                                                                                                                           | 'sticky'`after`footerAlign` (footer family); multi-line JSDoc with batch label on first line (manifest parser drops it — CK/CJ/CG precedent) |
| `packages/react/src/primitives/table/Table.tsx`                                       | Module helper `summaryStickyAttr` (`expandAnimAttr` precedent) · destructure `summaryRowStyle = 'default'` · 2 injection points: `renderSummaryRow` row div (`summaryRowStyle === 'sticky' && groupKey === undefined` — groupKey distinguishes global vs per-group summaries) + `renderFooterStack` footerMethod replacement rows (`summaryRowStyle === 'sticky'`, no groupKey in scope — global slot by construction) |
| `packages/react/src/primitives/table/Table.tsx` (live `TABLE_ROW_CSS`)                | +1 rule `[data-iris-table-fixed-height] [data-iris-summary-sticky="true"] { position: sticky; bottom: 0; z-index: 1 }` after the header sticky rule — same z-index tiering as header (2) / pinned (1); row already has opaque `--iris-surface` + 2px top border → zero inline style changes. Tokens only, no hardcoded values.                                                                                         |
| `packages/react/src/primitives/table/summary-sticky.test.tsx`                         | **NEW — 8 tests, ~170 lines** (default fail-closed double-check / explicit default / sticky attr + aggregate unchanged / stylesheet selector + sticky + bottom:0 + z-index / footerMethod slot gets attr + footerData excluded / group summaries excluded / virtual scroll preserves sticky / invalid value fail-closed)                                                                                               |
| `packages/manifest/manifest.json` + `llms.txt`                                        | regenerated — IrisTable props **172→173**, events 31 unchanged, 155×4 components, 86 tokens, enum `["default","sticky"]` captured                                                                                                                                                                                                                                                                                      |
| `docs/vxe-grid-comparison.md` + `docs/vxe-grid/DECISIONS.md` + `batch-cm-baseline.md` | comparison row 85 + build-status tail (批 CM entry) + stage records                                                                                                                                                                                                                                                                                                                                                    |

### Verification (all green)

- **core test**: 1559/1559 (zero core changes — framework-free invariant intact)
- **react typecheck**: clean · **react test**: **2519/2519** (2511 → +8) · **react lint**: 0 errors (1 pre-existing IrisTable complexity warning, same as prior batches)
- **iris-ui-spec.py --mode all**: **0 violations** (1416 files)
- **gen:manifest** regenerated (propCount 172→173, eventCount 31 unchanged)

### Explicit fiats (per baseline)

- Per-group summary rows never stick (`groupKey === undefined` gate) — groups would fight over the bottom edge
- footerData rows never stick — contractually rendered below the summary row

### What's left

- Review/gate stages (`batch-cm-review.md` / `batch-cm-gate.md` + full repo gate). Comparison row + build-status entry already in place (near-batch precedent).
- `arch-check` ratchet fails identically on clean HEAD (stale `arch-baseline.json`) — pre-existing, outside this batch's gates.
- Pre-existing dirty `docs/vxe-grid/batch-cl-gate.md` left untouched.
