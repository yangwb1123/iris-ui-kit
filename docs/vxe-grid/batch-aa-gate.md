Gate stage complete — **PASS**.

## 批 AA Gate — PASS ✅

**Review verdict**: PASS (1 medium finding + 3 low/info). Applied the medium finding's concrete fix in `packages/solid/src/primitives/table/IrisTable.tsx`:

- **spanMethod swap staleness (finding #1)**: the per-pass occupied set was rebuilt only on `bodyEntries` reference change, so swapping `spanMethod` to a different function without a data change left cells covered by the old method blank. Fix: key the rebuild on the `spanMethod` identity too (`spanMethodRef !== props.spanMethod` also clears the set). Regression test added (`parity-aa.test.tsx`: swap rowspan→no-span→rowspan with identical data/columns via a signal) — verified it fails without the fix and passes with it.
- **Manifest gate fix (found during gate)**: `@iris-ui-kit/manifest` test failed — the regex-based prop extractor split solid's multiline `spanMethod?: (params: IrisTableSpanMethodParams, ...)` signature (parens without braces) into a bogus non-optional `params` prop (`['columns','params']` vs required `['columns']` ×4). Fix: solid `props.ts` uses react's inline-object param form (parseable shape); `IrisTableSpanMethodParams` stays exported from `types.ts`. Manifest regenerated — `check:manifest` clean.

**Full repo gate** (`turbo run test typecheck lint build --concurrency=2`):

- **180/180 tasks** (1m33s, 131 cached), 0 failed
- Test counts: **solid 940/940** (124 files, +1 regression on 批 AA's 939) · react 1823/1823 · vue 1531/1531 · core 1249/1249
- `pnpm audit` → **0 known vulnerabilities**
- `gen:manifest` + `check:manifest` → **155 components × 4 frameworks aligned (4×155)**, zero drift, up to date
- Prettier clean on all changed files (incl. `docs/vxe-grid-comparison.md`)

**Docs** (`docs/vxe-grid-comparison.md`):

- 批 AA rows marked **✅ solid**: proxyConfig（含累计序号 + pagerConfig）/ formConfig / multiSort / 列显隐 columnVisibility / 筛选 filters / 序号 seq / 合并 spanMethod / 工具栏扩展 — summary paragraph + 现状对比 rows (序号列/合并单元格/排序/筛选/数据代理/搜索表单/工具栏 → 对齐 react+vue+solid) + build-status row
- Gaps list refreshed: solid 已对齐核心八项 (含 proxy 累计序号/导出按钮/批量按钮，vue 仍缺)；svelte 对齐为下一轮；heading updated (react 全量；vue 批 X–Z；solid 批 AA)

**Commit**: `feat(table): vxe-grid 批 AA——solid 适配器功能对齐（核心批）` (11 files: spanMethod fix + regression test (moved to `spanMethod.test.tsx` for the 500-line file gate) + manifest props fix + regenerated manifest/llms.txt + comparison doc + review doc + gate report + DECISIONS entries)
