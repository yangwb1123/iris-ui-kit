## Verdict: **PASS**

Review written to `docs/vxe-grid/batch-cg-review.md`. No implementation files modified.

### Verification results (HEAD `8d883dc2` = `777a8e4b` feat + docs)

| Check            | Result                                                          |
| ---------------- | --------------------------------------------------------------- |
| core test        | 1533/1533 ✅                                                    |
| react test       | 2454/2454 (incl. 14 new char-count tests) ✅                    |
| react typecheck  | clean ✅                                                        |
| react lint       | 0 errors, 1 pre-existing complexity warning unchanged at 284 ✅ |
| react build      | success ✅                                                      |
| audit:security   | no vulnerabilities ✅                                           |
| audit:tokens     | no new warnings from this batch (all `--iris-*` tokens) ✅      |
| check:manifest   | up to date, propCount 168→169 ✅                                |
| plugin-locale-zh | 6/6 (key coverage + placeholder parity) ✅                      |
| prettier         | clean ✅                                                        |

### Spec conformance highlights

- `charCount?: boolean` after `editAutoHeight` (`props.ts:405`); additive-only (all hunks pure additions; types.ts / solid·vue·svelte / core except 3 i18n strings untouched; core framework-free verified).
- Edit badge lives in the shared `EditorSurface` — one render site for cell + row modes, live `String(draft).length` via the existing session-store subscription (zero new state).
- Range badge at `activeRange.end` is a pure reduction over the existing `rangeStatsData` memo; same 0–100 `aggregateAccuracy` gate + `toFixed` as the summary row; fill-handle coexistence shifts it to `bottom: 10`.
- Fail-closed both modes; i18n EN+zh landed together; token-only chip styles with `insetInlineEnd` (RTL-safe) and `pointer-events: none`.

### Findings (1 low / 4 info, none blocking)

1. **low** `Table.tsx:237-244` — sum rounding lacks the `Number.isFinite(stats.sum)` guard the summary row/selection summary use; only bites on float overflow (prints `Infinity`). Fix: add the finite check.
2. **info** manifest `charCount` description is a mid-sentence fragment — pre-existing parser quirk (drops first JSDoc line), same as `emptyState`.
3. **info** `Table.tsx:6823` — `columnVirtualization` visible-window skip undercounts scrolled-out columns in the range; inherited from the reused memo, per-baseline design.
4. **info** `Table.tsx:1120` — UTF-16 code-unit counting (emoji = 2), per explicit baseline spec.
5. **info** edge overlap if a range-end cell is also the editing cell; cosmetic, both badges non-interactable.
