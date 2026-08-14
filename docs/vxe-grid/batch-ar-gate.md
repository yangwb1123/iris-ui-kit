Done. Batch AR gate **PASS** after fixing the review's Medium defect.

## Verdict → Fix

Review `batch-ar-review.md` was **FAIL** (1 Medium: the chart trigger click never closed the panel — pointerdown closed, then click reopened against the flushed state → the panel remounted and reset the selected column + kind; 1 Low: stale test count in docs).

**Fixes applied:**

- `ChartPanel.tsx` — outside-`pointerdown` exclusion now includes `[data-iris-chart-trigger]` (batch-edit precedent, Table.tsx:5044-5049): a press on the trigger no longer closes-then-reopens; the click toggles the panel cleanly
- `chart-preview.test.tsx` — +1 regression test: pointerdown on the trigger must NOT close (would remount + reset), the click then closes
- `batch-ar-adapt.md` — doc count stale: "9 tests" → "10 tests", verification "+9" → "+10" (chart-data.test.ts has 10 `it()` blocks)

**Verification of the fix (before full gate):** `chart-preview.test.tsx` 13/13 pass (incl. the new toggle test), `chart-data.test.ts` 10/10 pass, react `tsc --noEmit` clean, react eslint clean on both touched files.

## Full gate results

- `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks successful** (4m19s)
- `pnpm audit` → **0 known vulnerabilities**
- `gen:manifest` → 155 components × 4 frameworks, 86 tokens; `check:manifest` → up to date
- `check:docs-reference` → up to date

## Test counts

- core: **1364 passed** (87 files; incl. 10 `chart-data` tests)
- react: **1993 passed** (176 files; 1992 baseline + 1 new trigger-toggle test)
- repo total: **7631 tests** across packages + apps
- Desktop: tauri 2 ✅ · wails ok ✅ · electron smoke ✅

## Commit

- `a9d2e793` — `feat(table): grid 批 AR——迷你图表预览（自绘 SVG，查询闭环）` (5 files, +107/−5: ChartPanel.tsx fix, +1 test, adapt doc count, review + adapt docs, DECISIONS.md)

Working tree clean.
