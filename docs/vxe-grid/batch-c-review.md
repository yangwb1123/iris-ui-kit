Verdict written to `/home/u1/iris-ui/docs/vxe-grid/batch-c-review.md`.

## Verdict: **FAIL** (gates green, 2 real defects)

**Verification commands — all pass:**

- Core: 1213 passed (79 files, incl. 12 new remote-table tests)
- React: 1525 passed (141 files, incl. 8 new proxy-config tests)
- React typecheck: clean · lint: 0 errors (complexity warning verified pre-existing: HEAD already 92 > 70, now 112)
- Audit: `iris-ui-spec.py --mode all` → 0 violations in 1401 files
- Core framework-import invariant: 0 matches

**Checklist (8/8 implemented & tested):** autoLoad=false defers ✅ · remoteSort/remoteFilter re-query + page reset, local flags preserved ✅ · loading/error rows render with error→loading→empty→rows precedence ✅ · total-driven pager, page-change query, onPageChange ✅ · epoch-token latest-wins ✅ · edit write-back survives into next refetch ✅ · zero framework imports ✅ · additive only ✅

**Real defects (why FAIL):**

1. **Medium — `remote-table.ts:133`**: page reset keys on _key presence_, not _value change_. A controlled `sort`/`filters` prop with fresh object identity each render (inline literal) causes a spurious reset-to-1 + refetch on every parent render while page > 1; inline `sort` silently reverts page navigation. Fix: value-compare effective sort/filters before resetting.
2. **Medium — `remote-table.ts:25/130`**: contract documents empty string = "inactive", but `''` filter entries are forwarded verbatim to the server query (and dedupe treats `{name:''}` ≠ `{}`). A verbatim server returns zero rows for a cleared filter. Fix: strip `''` entries in one normalization point.

**Low:** autoLoad effect `[]`-deps misses late-arriving proxyConfig + skips destroy cleanup (Table.tsx:312) · pager/params divergence when total shrinks below current page (stale page query, unrecoverable) · explicit-`undefined` `initialParams` fields → `Object.keys(undefined)` TypeError / NaN paging.

Informational: manifest needs `gen:manifest` in the pipeline, `seq` restarts per page (pre-existing), `proxyConfig` fields are creation-time only (doc gap), complexity warning grew 92→112.

## Gate 修复记录（2026-08，batch C gate stage）

Verdict 的缺陷已全部修复并复验，全仓门通过后提交：

1. **Medium 1（page reset 键存在性而非值变化）** — `remote-table.ts` `applyParams` 改为值比较
   （`sortEqual`/`filtersEqual`）：受控 `sort`/`filters` prop 每次渲染新对象但值相同时不再
   重置页码/重复请求。回归测试：core `same-value sort/filter with fresh object identity…` +
   react `same-value controlled sort with fresh identity does not reset an active page`。
2. **Medium 2（`''` filter 原样转发）** — 新增 `normalizeFilters`，在 initial 种子与每次
   `applyParams` 合并处统一剥离空串条目；`{ name: '' } ≡ {}` 参与去重。回归测试：core
   `strips empty-string filter entries…` + react `empty-string filters are inactive…`。
3. **Low（autoLoad effect）** — `Table.tsx` effect 以 proxy **存在性**（`hasProxy`）为依赖：
   迟到 proxyConfig 仍自动加载并注册 destroy；移除/卸载时销毁控制器；StrictMode 重挂载时
   effect 内重建 + forceRender（`useSyncExternalStore` 重新订阅新实例）。
4. **Low（total 收缩分页卡死）** — core `loadClamped()`：响应后若 `total` 已不覆盖当前页，
   自动回退到最后一个有效页并重查（仅在成功且无 error 时）。
5. **Low（显式 `undefined` initialParams）** — initial 构造改为逐字段 `??` 默认值，
   不再把 `undefined` 种进引擎（NaN 分页 / `Object.keys(undefined)` TypeError）。

复验：core 1217 tests（79 files，+4）· react 1528 tests（141 files，+3）· 180/180 turbo ·
审计 0 violations（1401 files）· `gen:manifest` 155 组件。
