Done. Batch AQ gate **PASS** after fixing the review's Medium defect.

## Verdict → Fix

Review `batch-aq-review.md` was **FAIL** (1 Medium: stale `suppressRangeDismissRef` broke Escape-clear after a fill drag).

**Fix applied:**

- `Table.tsx` — reset `suppressRangeDismissRef.current = false` in `handleRangeFillPointerUp` and the `onPointerCancel` handler, re-arming Escape/outside dismissal once the drag ends
- `range-fill.test.tsx` — +2 regression tests (Escape after completed drag, Escape after cancelled drag); verified both **fail on unfixed code** (stash repro) and pass with the fix

## Full gate results

- `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks successful** (1m44s)
- `pnpm audit` → **0 known vulnerabilities**
- `gen:manifest` → 155 components × 4 frameworks, 86 tokens; `check:manifest` → up to date

## Test counts

- React: **1980 passed** (175 files, 1978 baseline + 2 new)
- Desktop: tauri 2 ✅ · wails ok ✅ · electron smoke ✅

## Commits

- `165b6540` — `feat(table): grid 批 AQ——拖拽填充柄（Excel 式选区填充）` (5 files, +101/−41)
- `53d9cad6` — `chore: 批 AQ 收尾（gate 报告 + DECISIONS）` (gate report + DECISIONS.md entry)

Working tree clean.
