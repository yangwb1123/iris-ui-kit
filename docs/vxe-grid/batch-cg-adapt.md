Batch CG complete and committed.

## Report

**Commits**: `777a8e4b` (feat) + `9e9e55e6`-ish (docs adapt report)

**Files changed** (4 source + 1 test + manifest + docs; ≤4 + tests met):

- `packages/react/src/primitives/table/props.ts` — `charCount?: boolean` (single-line member after `editAutoHeight`; `*/` on its own line so the manifest description parser captures the full JSDoc). Prop count **168 → 169**.
- `packages/react/src/primitives/table/Table.tsx` — module helpers (`isRangeCharCountHost`, `charCountCellStyle`, `rangeCharCount`, `renderRangeCharCountBadge`) keeping the hot row arrow flat; `EditorSurface` gains `charCount` + `t` props and renders the live badge (`String(draft).length` per keystroke via the existing session-store subscription — zero new state, one render site for cell AND row modes); both call sites pass them; style branch + selection-badge render reuse the existing `rangeStatsData` memo; sum rounded through the same `aggregateAccuracy` gate; fill-handle collision shifts the badge to `bottom: 10px`.
- `packages/react/src/primitives/table/styles.ts` — `CHAR_COUNT_STYLE` + `CHAR_COUNT_HANDLE_SHIFT_STYLE` (token-only `--iris-*`).
- `packages/core/src/i18n.ts` + `packages/plugin-locale-zh/src/core/index.ts` — 3 EN + 3 zh keys landed together (zh full-coverage + placeholder-parity gates green).
- NEW `packages/react/src/primitives/table/test/char-count.test.tsx` — **14 tests / 207 lines** (≤500): 6 编辑计数 (live up/down, textarea newlines, row-mode per-column, fail-closed, zh `5 字`) + 8 选区计数 (text-only `4 cells`, numeric `sum 85`, mixed, Escape cleanup, fail-closed, fill-handle 10px shift, default 2px, aggregateAccuracy rounding `3.579→3.58`).
- `packages/manifest/{manifest.json,llms.txt}` — regenerated & committed.

**Counts**: react 2440→**2454** · core 1533 unchanged · manifest n 168→**169** · spec **0 violations**.

**Verification** (all ✅ on committed state): core test 1533/1533 · react typecheck · react test 2454/2454 (edit/range/fill suites stay green) · react lint **0 errors** (1 pre-existing IrisTable complexity warning, unchanged at 284) · `iris-ui-spec.py --mode all --json` 0 violations · `gen:manifest` regenerated + committed · prettier clean.

**What is left**: runner's review/gate stage. Working-tree dirt (`DECISIONS.md`, `batch-cf-gate.md`) is prior-stage leftovers, untouched. No baseline open questions.
