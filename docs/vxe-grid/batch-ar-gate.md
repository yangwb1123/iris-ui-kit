Gate stage complete — **PASS** after fixing the review's 2 findings.

## Verdict → Fixes

- **[Medium]** `ChartPanel.tsx` — added `[data-iris-chart-trigger]` to the outside-`pointerdown` exclusion (batch-edit precedent): pressing the trigger now toggles instead of pointerdown-close → click-reopen → remount/reset. +1 regression test in `chart-preview.test.tsx` (pointerdown must not close; click closes). Verified 13/13 before the gate.
- **[Low]** `batch-ar-adapt.md` — "9 tests" → "10 tests", "+9" → "+10" (chart-data.test.ts has 10 `it()` blocks).

## Full gate (all green)

- `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks successful**
- `pnpm audit` → **0 known vulnerabilities**
- `gen:manifest` + `check:manifest` → up to date (155 components × 4 frameworks, 86 tokens; `chartPreview` react-only)
- `check:docs-reference` → up to date

## Test counts

- core: **1364 passed** (87 files, incl. 10 `chart-data`)
- react: **1993 passed** (176 files; +1 new trigger-toggle test)
- repo total: **7631 tests** across packages + apps
- Desktop: tauri 2 ✅ · wails ok ✅ · electron smoke ✅

## Commits

- `a9d2e793` — `feat(table): grid 批 AR——迷你图表预览（自绘 SVG，查询闭环）` (5 files, +107/−5)
- `55c6fef8` — `chore: 批 AR 收尾（gate 报告 + DECISIONS）`

Working tree clean. Gate report: `docs/vxe-grid/batch-ar-gate.md`.
