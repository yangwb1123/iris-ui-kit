## ✅ Batch W gate — PASS (review was FAIL, fixes applied)

**Verdict:** `batch-w-review.md` → FAIL with concrete fixes. Applied both:

- **F1 (HIGH, staleness)** — `tableRef` is assigned once on mount, so handle methods ran against the mount render's memos. Fixed by mirroring `filteredData` → `filteredDataRef` and `leafColumns` → `viewColumnsRef` per render (same pattern as `liveDataRef`/`displaySelectionRef`), rewrote the false "re-created every render" comments. Added **3 post-mount rerender tests** (filters `ali`→`bob`, data shrink, columnVisibility — export drops `Age`).
- **F2 (MEDIUM, grouped export)** — export now uses `viewColumnsRef` (= `leafColumns`; reference-identical to `displayColumns` in flat mode → zero flat regression). Added **1 grouped export test** (leaf `Name,Age` columns + all rows).
- F3 informational — no fix required.

**Full repo gate:**

| Step                            | Result                                                             |
| ------------------------------- | ------------------------------------------------------------------ |
| turbo test/typecheck/lint/build | **180/180 tasks successful** (1m39s)                               |
| audit                           | **0** (security 0 vulns; iris-ui-spec.py 0 violations, 1405 files) |
| gen:manifest + check:manifest   | 155 components all-framework aligned; **up to date**               |

**Comparison doc:** batch W rows marked done (导出当前视图 / getFilteredData / 表头表尾溢出, all react; 表格方法 + 导入导出 rows updated, 批 W row `✅ react`), totals refreshed: react 1810 → **1823**, total 7411 → **7424**.

**Commit:** `fb51579d60161b32b112811675fd5238560d4f92` — `feat(table): vxe-grid 批 W——导出当前视图/过滤数据方法/表头表尾溢出（react only）` (7 files, +273/−110; gate report `docs/vxe-grid/batch-w-gate.md` included). Working tree clean.

**Final test counts:** react **1823/1823** (161 files) · core 1249 · **7424 total** · 180/180 turbo · audit 0.
