Batch CG（单元格字数统计，iris 独有）complete and committed.

## Report

**Commit**: `777a8e4b` — `feat(table): grid 批 CG——单元格字数统计（iris 独有）` (baseline + adapt docs + source + manifest in the same commit, batch CF precedent).

**Files changed** (4 source + 1 test + manifest + docs; ≤4 + tests):

- `packages/react/src/primitives/table/props.ts` — `charCount?: boolean` after `editAutoHeight` (single-line member, `*/` on its own line so the manifest description parser captures the full JSDoc). Prop count **168 → 169**.
- `packages/react/src/primitives/table/Table.tsx` — module helpers (hot-arrow budget discipline): `isRangeCharCountHost` / `charCountCellStyle` (style branch: editing cell + range-end host gain `position: relative`) / `rangeCharCount` (pure reduction over the EXISTING `rangeStatsData` memo: count = Σ column non-null counts, sum = Σ numeric column sums, null = no numeric data) / `renderRangeCharCountBadge` (count + sum, sum rounded via the SAME `aggregateAccuracy` gate as the summary row / selection summary; shifts to `bottom: 10px` when the host cell is also the fill-handle host). `EditorSurface` gains `charCount` + `t` props and renders the live badge (`String(draft).length`, recomputed per keystroke through the existing session-store subscription — zero new state) so cell AND row edit modes share one render site. Both `EditorSurface` call sites pass `charCount={charCount}` + `t={t}`. Component complexity stays 284 (flat, not a regression).
- `packages/react/src/primitives/table/styles.ts` — `CHAR_COUNT_STYLE` + `CHAR_COUNT_HANDLE_SHIFT_STYLE`: token-only corner chips (`--iris-*` only), pointer-transparent, zIndex 4 above the fill handle.
- `packages/core/src/i18n.ts` — 3 EN keys: `table.charCount` `{count} chars` / `table.charCount.range` `{count} cells` / `table.charCount.rangeSum` `sum {sum}` (placed with the range keys).
- `packages/plugin-locale-zh/src/core/index.ts` — 3 zh keys (`{count} 字` / `{count} 个单元格` / `合计 {sum}`) — landed together so the zh full-coverage + placeholder-parity gates stay green.
- `packages/react/src/primitives/table/test/char-count.test.tsx` — **NEW**, 14 tests / 207 lines (≤500).
- `packages/manifest/{manifest.json,llms.txt}` — regenerated & committed (charCount prop 168→169, react/solid/svelte entries).
- `docs/vxe-grid/batch-cg-baseline.md` — baseline doc, committed.

**Tests added** (14; baseline planned 13, split the fill-handle case into 2): 编辑计数 6 — live count grows, counts down on deletion, textarea newlines counted (each `\n` = 1 char), row mode per-column badge (2 editors), fail-closed no-badge, zh `5 字`; 选区计数 8 — text-only `4 cells` (no sum), numeric `sum 85`, mixed `4 cells · sum 57`, Escape clears range + badge, fail-closed no-badge, fill-handle coexistence `bottom: 10px` (and that EVERY range end is the handle host while `rangeFill` is on), default `2px` corner without `rangeFill`, `aggregateAccuracy={2}` rounds `3.579 → 3.58`.

**Counts**: react 2440→**2454** · core 1533 unchanged · manifest 69 · spec **0 violations** (hex/spacing/shadow/font).

**Verification** (all on the committed state):

- core test ✅ 1533/1533 (i18n keys landed with zh parity)
- react typecheck ✅ · react test 2454/2454 ✅ (edit/range/fill/range-stats suites stay green) · react lint **0 errors** (1 pre-existing IrisTable complexity warning, unchanged at 284)
- `iris-ui-spec.py --mode all --json` → 0 violations ✅
- `gen:manifest` regenerated + committed ✅ (n 168→169)
- plugin-locale-zh test ✅ 6/6 (full-key coverage + placeholder parity)
- prettier --check on all changed files ✅

**What is left**: runner's review/gate stage. Working-tree dirt (`DECISIONS.md`, `batch-cf-gate.md`) is prior-stage leftovers, untouched. Design decisions from the baseline all implemented as specified; no open questions.
