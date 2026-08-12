All gates green, committed as `7b4cd99d`. Final report:

## 批 AG 完成报告

**实现（全部按 baseline 验证后的方案）**

**1. `persistState` 状态持久化**（iris 独有，react）

- 新 hook `packages/react/src/primitives/table/usePersistState.ts`（183 行）：受控表格的纯 LOADS/SAVES 协调器，零新增内部状态
  - 挂载读回快照（lazy ref 初始化，**SSR window 守卫**，SSR 下严格 no-op）→ 经 change 回调回放恢复（`sort→onSortChange`、`multiSortState→onMultiSortChange`（仅 multiSort 模式）、`filters/filterValues/columnVisibility/columnOrder/columnWidths` 各自回调；无回调的块不恢复）
  - 每次变更把**当前 props** 序列化写回；逐通道 skip-first ref：恢复 effect 声明在保存订阅**之前**，挂载提交对被恢复通道保留**恢复值**（永不写回恢复前的值），JSON 去重幂等写；空快照不写
  - `storage: false` 完全禁用（不读不写）；默认键 `'iris-table-state'`；`include` 默认全部 8 块；损坏 JSON/非对象值忽略
  - **pageSize 特例**：hook 进代理创建 effect、在 `ctrl.request()` **之前**经 `onPageChange(1, restored)` + `request({pageSize, page:1})` 应用（发现并修复了 `setParams` 自带重查导致的**双请求**——改为单次恢复查询）；无 `proxyConfig.onPageChange` 则整体跳过
- props.ts 单行 `persistState?: import('./types').IrisTablePersistConfig`（与既有 `filterValues` 内联 import 约定一致）；types.ts 新增命名导出 `IrisTablePersistConfig` / `IrisTablePersistPiece` / `IrisTablePersistedState`；barrel 已导出（manifest 拾取 ✓）

**2. 可变高度虚拟化**（core/virtual.ts + VirtualScroll.tsx 零改动，如 baseline 确认）

- 仅收窄 `IrisTableVirtualOptions.itemHeight` 为 `number | ((index) => number)`；既有 pass-through（L4997）流入已支持 offset 树的 `IrisVirtualScroll`；行按**累计偏移** `translateY(cum[i])` 定位，函数收到**虚拟 plan 下标**（文档化陷阱 + 显式给详情槽定高）

**测试**（21 新，3 个文件均 ≤500 行）

- `persist-state.test.tsx` 14 个：存储 stub 挂载恢复经回调 / 变更触发 JSON 保存 / 挂载提交不覆盖存储 / storage:false 零读写 / 损坏 JSON 忽略 / 非对象 JSON 忽略 / include 双向限制 / multiSort 门控 / 自定义 key / pageSize 代理恢复（单次查询断言）/ 无代理跳过 / localStorage 默认适配器 / 配额错误不崩 / 无 prop 零访问
- `persist-state-ssr.test.tsx` 1 个（node 环境 renderToString 不触存储）
- `virtual-height.test.tsx` 6 个：累计 top 定位 / 固定数字形不变 / 滚动窗口边界 / 深滚动无漂移 / 固定形深滚动闭式窗口 / **plan 下标陷阱**（detail 槽交错）

**文档**：`docs/vxe-grid-comparison.md` 新增「iris 独有（批 AG）」节（persistState + 可变高度虚拟化对照 vxe `virtualYConfig` 增强模式）+ 构建状态表批 AG 行

**验证结果（全部通过）**

| 门                | 结果                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| core test         | 1255/1255（零 core 改动）                                                                       |
| react typecheck   | ✅                                                                                              |
| react test        | 1850/1850（+21）                                                                                |
| react lint        | 0 errors（1 个既有 complexity warn，非本次引入）                                                |
| spec `--mode all` | **0 violations**                                                                                |
| gen:manifest      | 已重新生成并提交：155 组件（react 124 props，新增 persistState + 3 类型，`unavailable=0` 不变） |

**提交**：`7b4cd99d`（含 baseline 文档、DECISIONS 流水线日志、manifest.json/llms.txt 再生成；工作树干净）

**剩余/决策**：① persistState 与函数形 itemHeight 为 react-only（批范围如此），vue/solid/svelte 对齐留待后续批；② pageSize 恢复在 `autoLoad: false` 下仍执行单次恢复查询（core 无"不重查的 setParams"公开路径，已注释文档化）；③ 文件行数门触发的收尾：props.ts 现恰好 500 split（删除 import 块后空行 + 单行 JSDoc 换内联 import 类型），types.ts 499 split；④ manifest 中 `persistState` 类型显示为 `import('./types').IrisTablePersistConfig`——与既有 `filterValues` 约定一致。
