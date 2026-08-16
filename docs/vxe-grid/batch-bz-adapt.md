All verification green. Final report:

## Batch BZ — 表格状态导出导入（`exportStateJson` / `importStateJson`，iris 独有）complete

**Commit `e6e01ae5`** — `feat(table): grid 批 BZ——表格状态导出导入（iris 独有）`

### Files changed (committed)

| File                                                     | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/types.ts`           | `IrisTableHandle` +2 方法（`exportComparisonCsv` 后）：`exportStateJson(): string` / `importStateJson(json: string): boolean`（JSDoc：9 块 spec / multiSortState 刻意不导出、导入接受超集 / pageSize 单请求 / expandedKeys 全量替换 / 非法 JSON false 零应用）                                                                                                                                                                                                   |
| `packages/react/src/primitives/table/Table.tsx`          | 4 触点 + 2 ref 镜像：① `persistSnapshot` memo 门移除（`persistState \|\| views` → 无条件，裸表可导出；hasConfig / views config 门双兜底）② query 收集无条件（persist 保存循环无 `query` 键，字节不变）③ `persistSnapshotRef` 镜像（挂载闭包读最新快照）④ `applyViewSnapshotRef` 镜像；handle +`exportStateJson`（边界剥离 `multiSortState`）/`importStateJson`（JSON.parse try/catch + 非纯对象守卫 → `false`；复用 `applyViewSnapshotRef` 逐项经回调 → `true`） |
| `packages/react/src/primitives/table/props.ts`           | `tableRef` JSDoc 更新（多行 JSDoc 按仓库约定：`/**` 独行 + 内容行 + ` */` 独行 —— manifest 扫描器丢首尾同行的内容）                                                                                                                                                                                                                                                                                                                                              |
| `packages/react/src/primitives/table/usePersistState.ts` | 注释勘误：保存 effect 注释改述「收集器 memo 无条件化后 `hasConfig` 门语义」（views-only/裸表永不写 persist key）                                                                                                                                                                                                                                                                                                                                                 |
| `test/state-export-import.test.tsx` (NEW)                | **12 tests, 483 lines** (≤500)                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `packages/manifest/manifest.json`                        | regenerated — 结构零 diff（IrisTable 165 props / 31 events 不变；`tableRef` description 更新）                                                                                                                                                                                                                                                                                                                                                                   |
| `docs/vxe-grid-comparison.md`                            | 2 places（persistState 行 + 构建状态追加）                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `docs/vxe-grid/batch-bz-baseline.md` (NEW, 前置)         | baseline（本批唯一新文档，零源文件触碰）                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `docs/vxe-grid/batch-bz-adapt.md` (NEW)                  | adapt report（本文件）                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### Tests added (12)

导出结构：全通道 9 键（sort/filters/filterValues/columnVisibility/columnOrder/columnWidths/pageSize/expandedKeys/query 全在场 + 逐值断言）→ 门控惰性（仅 onSortChange 裸接 → 只出 `sort: null`）→ 裸表 `'{}'`。导入应用：逐回调原值（9 块全回放 + 展开 DOM + 全量替换）→ query 先行（order: `['query','sort']`）→ pageSize 单请求（`onPageChange(1,25)` + 恰一次 request `{page:1,pageSize:25}`）→ expandedKeys 全量替换 + DOM 展开 → 往返字节相等（export→import→export 字符串恒等）。非法：5 种坏输入（`'{oops'`/`''`/`'null'`/`'[]'`/`'42'`）→ `false` 零回调零 DOM → 损坏块惰性（类型守卫跳过、好块照常、仍 `true`）→ 无回调块惰性（sort/query 无回调跳过、filters 应用、仍 `true`）→ multiSortState 超集导入应用但永不导出。

### Verification (all ✅)

- core test **1517/1517** · react typecheck **clean** · react test **2385/2385**（BZ +12，react 2373→2385）· react lint **0 errors**（1 既有 complexity warning，git stash 验证为前置）
- `iris-ui-spec.py --mode all` → **0 violations**（1415 files）· `gen:manifest` 重生成（已提交）· prettier hook clean
- Constraints held：core / vue / solid / svelte / styles.ts 零改动（framework-free 隐式满足）· react-only · additive（propCount/eventCount 不变）· ≤4 source files + 1 test · test ≤500 lines

### Deviations from baseline (documented)

- **multiSortState 排除在导出边界而非收集器**：收集器保留 `multiSortState`（persistState/views 仍需它，persist-state.test 的 multiSort 恢复用例不能破坏）——`exportStateJson` 先浅拷贝快照再 `delete multiSortState` 后序列化；导入经 `applyViewSnapshot` 天然接受超集。
- **props.ts JSDoc 按扫描器约定重写**：初版多行 JSDoc 首行带内容、末行带 `*/`，manifest 扫描器（`consumeDocComment` 只认单行 `/****/` + 块注释逐行累积丢首尾同行走）产出残缺 description（`"additions): …"`）；改为 `/**` 独行 + 内容行 + ` */` 独行后 description 完整。
- **测试 harness 教训**：受控 harness 包装回调恒在场（`onSortChange={(next) => …}`）会破坏「无回调惰性」断言——门控/惰性测试改用裸 `IrisTable` 直连；代理查询必须返回本地 rows（空页无 DOM 行，`toggle(2)` 找不到元素）；detail 模式首列是展开列头（`data-iris-table-header=""`），排序点击按 `data-iris-table-header={key}` 定位。

### What is left

- Runner 的 **review/gate** 阶段（DECISIONS.md / batch-by-gate.md 工作树改动为 BY gate 阶段遗留，本批未触碰；下次提交含 review 修复时一并折叠）。
- 开放问题（基线遗留）：① 收集器门放宽（无条件收集 + 导出边界剥离）已按本实现仲裁；② vue/solid/svelte 对齐延后 — react-only scope。
