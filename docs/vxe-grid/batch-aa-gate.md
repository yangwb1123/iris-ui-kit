Gate complete. Final state verified — working tree clean, single commit `efd6072`.

## 批 AA Gate — PASS ✅

**Review verdict**: PASS (1 medium finding + 3 low/info). Applied the medium finding's concrete fix, plus a manifest-gate failure discovered during the gate:

1. **spanMethod swap staleness** (`IrisTable.tsx`) — occupy-set rebuild now keyed on `props.spanMethod` identity in addition to the `bodyEntries` reference; a swapped callback without data change now drops stale coverage. Regression test added (rowspan → no-span → rowspan with identical data, via signal) — **verified it fails without the fix, passes with it**.
2. **Manifest gate failure** (`@iris-ui-kit/manifest` test) — the regex extractor split solid's multiline `spanMethod?: (params: IrisTableSpanMethodParams, …)` signature into a bogus non-optional `params` prop (`['columns','params']` vs required `['columns']` ×4). Fixed by using react's inline-object param form; `IrisTableSpanMethodParams` stays exported. `gen:manifest` + `check:manifest` now clean (155×4 aligned).

**Full repo gate** (`turbo run test typecheck lint build --concurrency=2`):

| Check    | Result                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------- |
| turbo    | **180/180 tasks**, 0 failed (1m33s, 131 cached)                                                 |
| tests    | **solid 940/940** (125 files, +1 regression) · react 1823/1823 · vue 1531/1531 · core 1249/1249 |
| audit    | **0 known vulnerabilities**                                                                     |
| manifest | gen + check clean, **155 × 4 frameworks** aligned, zero drift                                   |
| prettier | clean on all changed files (incl. comparison doc; my doc edits were re-formatted)               |

**Docs** (`docs/vxe-grid-comparison.md`): 批 AA marked **✅ solid** — summary paragraph + 7 现状对比 rows → 对齐 (react+vue+solid) + build-status row; gaps list refreshed (solid 已对齐核心八项 incl. proxy 累计序号/导出按钮/批量按钮 — vue 仍缺; svelte 对齐为下一轮).

**Commit**: `efd607233dd2d7224f129c9a8100eba08296d77a` — `feat(table): vxe-grid 批 AA——solid 适配器功能对齐（核心批）` (11 files, +196/−104; gate report + review doc + DECISIONS entries included). One note: the 500-line pre-commit file gate forced the spanMethod tests into a new `spanMethod.test.tsx` (parity-aa now 468 lines).
