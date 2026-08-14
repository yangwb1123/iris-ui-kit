Gate stage complete — **PASS** after fixing the review's 3 LOW findings.

## Verdict → Fixes

- **[LOW] `Table.tsx:1308`** — `freshnessAt` starts at 0 → first paint/SSR of a data-prop table flashed local _epoch_ time until the effect ran. Fixed: stamp gated on `freshnessAt > 0` (`{freshness && freshnessAt > 0 && liveData.length > 0}`).
- **[LOW] `Table.tsx:1203`** — `intervalMs <= 0` doesn't catch NaN/Infinity (`NaN <= 0` is false) → `setInterval(cb, NaN)` ≈ 0 ms refetch storm. Fixed: `!Number.isFinite(intervalMs) || intervalMs <= 0`.
- **[LOW] `props.ts`** — compact multi-line JSDoc on `autoRefresh`/`freshness` was mangled by the manifest prop scanner (first line + closing word dropped; `check:manifest` can't catch it). Fixed: converted both to block-style JSDoc (the `chartPreview` precedent) → regenerated manifest now shows full head and "Additive — default off." tail.

## Full gate (all green)

- `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks successful** (54 cached)
- `pnpm audit` → **0 known vulnerabilities**
- `gen:manifest` + `check:manifest` → up to date (155 components × 4 frameworks, 86 tokens; `autoRefresh`/`freshness` descriptions complete)

## Test counts

- core: **1366 passed** (87 files)
- react: **2005 passed** (177 files; incl. auto-refresh + freshness suites — no regressions from the 3 fixes)
- Desktop: tauri 2 ✅ · wails ok ✅ · electron smoke ✅

## Commits

- `caf25a7f` — `feat(table): grid 批 AS——自动刷新 + 数据新鲜度指示（数据闭环）` (6 files, +72/−42: 2 low fixes + JSDoc + regenerated manifest + review/adapt/DECISIONS docs)

Working tree clean. Gate report: `docs/vxe-grid/batch-as-gate.md`.
