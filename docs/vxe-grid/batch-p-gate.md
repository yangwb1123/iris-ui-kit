# Batch P Gate Report

Verdict: **FAIL → 4 fixes applied → PASS** (review: `docs/vxe-grid/batch-p-review.md`).

## Review fixes applied

1. **MAJOR — manifest stale**: `pnpm gen:manifest` regenerated; the 2 generated files
   (`packages/manifest/manifest.json`, `llms.txt`) committed. `pnpm check:manifest` now passes
   ("manifest generated output is up to date"). Adds exactly the 7 batch-P props
   (IrisTable react propCount 93→100); 155 components × 4 frameworks, `unavailable = 0`.
2. **MAJOR — footer `rowspan` corrupts the stack**: each footer row is its own grid
   container, so `gridRowEnd: span N` could never cover later rows while the occupy
   marking made their cells silently disappear (probe: `'Grand'` vanished). Fix:
   footer rowspan is **inert** — occupy marking and `gridRowEnd` removed from all three
   footer paths (summary / footerMethod / footerData), mirroring `mergeHeaderCells`;
   JSDoc updated in `props.ts` + `types.ts`.
3. **MINOR — `mergeHeaderCells` not fail-closed under `columnVirtualization`**: code now
   gates merge with `!!mergeHeaderCells && !columnVirtualization` (visible-window track
   shift would misalign spans) — matches the prop JSDoc.
4. **MINOR — `aggregateAccuracy` unvalidated**: `toFixed(n)` throws `RangeError` for
   n<0 / n>100; values outside 0–100 are now ignored (no rounding), documented.
5. **Bonus**: fixed a React "unique key" warning — the global summary row in the footer
   stack array was unkeyed (batch-P regression from the stack refactor); now wrapped in a
   keyed Fragment (same pattern as group summaries).

## Regression tests added (`test/merge-round-accuracy.test.tsx`, +4)

- `mergeHeaderCells` fail-closed under `columnVirtualization` (3 headers, no spans)
- footer `{rowspan:2}` at `[0,0]` → later stack rows keep every cell, no `gridRowEnd`
- `aggregateAccuracy` -1 / 101 → no RangeError, unrounded values
- empty footer tooltip content drops the `title`

## Gate results

- Full repo gate: `turbo run test typecheck lint build` → **180/180 tasks**
- React tests: **1709/1709** (1705 + 4 new)
- Typecheck: 0 errors · lint: 0 errors (1 pre-existing complexity warning)
- `pnpm audit`: **0 vulnerabilities**
- `pnpm gen:manifest` + `check:manifest`: pass
- Format: prettier clean
- `docs/vxe-grid-comparison.md`: batch P rows marked done (react) —
  mergeHeaderCells / footerSpanMethod / round / padding / aggregateAccuracy /
  header+footer tooltips (+ section 4 / section 10 annotations + 批 P build row)

## Commit

`2aa986ccbe6e24c2bb8cfda2fc674e5f2385f7a4`
`feat(table): vxe-grid 批 P——表头表尾合并/圆角内边距/合计精度/表头表尾提示（react only）`
