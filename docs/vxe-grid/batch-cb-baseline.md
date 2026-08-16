Baseline complete. **Output: `/home/u1/iris-ui/docs/vxe-grid/batch-cb-baseline.md`** (333 lines, the only new file — zero source files touched; the 3 pre-existing `M` entries are prior-stage docs, untouched).

## 核验摘要 (batch CB：最近筛选，iris 独有)

**设计** — 表级 prop `IrisTableProps.recentFilters?: boolean`（默认 off，additive，manifest propCount 166→167）：

1. **core `createRecentFilters`**（NEW `recent-filters.ts`，框架无关，createAuditLog 1:1 模具）：环形 10 条，`record(key, values)` 压入 `{ key, values, ts }`（newest-first + `ensureBound` 裁最旧）；**同 key+同 values 集合去重置顶**（MRU）；`list/clear/subscribe/getVersion/depth` 全 API。
2. **记录点** = `applyFilterValues`（Table.tsx :4066，确认咽喉）：`values.length > 0` 才记录（空集=清除语义，`mergeFilterValues` :1546 先例）；受控无关（无 handler 也记录）。
3. **面板显示** = FilterPanel 泛型化，options 上方新增最近区（muted 标题 `data-iris-filter-recent-title` + 条目按钮 `data-iris-filter-recent={i}`）；label = 列标题 + 选项 label 拼接（未知列 fail-inert 回落）。
4. **点击快速应用** = `onApplyRecent(entry)` → `applyFilterValues(entry.key, entry.values)`（跨列应用）+ 关闭 + 自动 MRU 置顶；`filterPanelSeq` remount 播种 → **零 useSyncExternalStore 订阅**。
5. **i18n**：+1 键 `table.recentFilters`（en `Recent filters` / zh `最近筛选`）。
6. **测试**：core 8 + react 7 = 15（core 1525→1533 · react 2392→2399），spec 三块 mandatory 全覆盖（记录/列表/应用）。

**文件地图** — core +`recent-filters.ts`/`recent-filters.test.ts`/`index.ts` barrel/`i18n.ts`(+1) · zh 插件 +1 · react +`props.ts`(:257 后)/`Table.tsx`(import/destructure/控制器+记录点/面板传参)/`FilterPanel.tsx`(泛型+3 props+最近区)/NEW `recent-filters.test.tsx` · manifest 重生成（166→167）· comparison doc 2 处。**零改动**：types.ts / styles.ts / core package.json（无新子路径）/ 三框架。

**10 fiats + 2 开放问题**（O1 清空入口、O2 persistState 第 10 块候选），全部锚点已对 HEAD `f7426654` 逐行核验。
