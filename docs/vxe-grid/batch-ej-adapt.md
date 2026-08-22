## 批 EJ 完成报告

**SPEC**: svelte IrisTable 状态持久化 `persistState?: { storage?; key?; include? }`（sort/filters/columnVisibility/columnOrder/columnWidths/pageSize），react AG 语义逐字镜像、runes 化。已提交 `dcc04c8f`（工作树仅剩会话前既有 dirt）。

### 文件变更（8 源/测试 + 文档 + manifest）

| 文件                                   | 变更                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`                             | +3 具名导出：`IrisTablePersistPiece`（spec 六块）/ `IrisTablePersistedState` / `IrisTablePersistConfig`                                                                                                                                                                                                                                            |
| `props.ts`                             | 单行 prop `persistState?: import('./types').IrisTablePersistConfig`（line-152 区、manifest 扫描器卫生）                                                                                                                                                                                                                                            |
| **NEW** `table-persist.svelte.ts`      | 纯 LOADS/SAVES 协调器（186 行）：setup 一次性解析 + SSR window 守卫 + 逐通道 skip-first + 整包 JSON 去重 + 空快照不写 + `storage:false`/坏 JSON/写错误 fail-inert；`IRIS_TABLE_PERSIST_DEFAULT_KEY` 导出                                                                                                                                           |
| `IrisTable.svelte`                     | 4 触点 + 2 effect：`applySort` 咽喉提取（views+persist 共享）；收集器「可恢复的才保存」（sort/filters/widths/pageSize 各按回调门，代理模式才收集 pageSize）；恢复 effect 先于保存 effect；pageSize 特例在代理创建 effect 内**首次 query 前** `onPageChange(1, size)` + 恰一次 `request({pageSize, page:1})`                                        |
| `index.ts`                             | +3 类型导出（manifest 拾取 ✓）                                                                                                                                                                                                                                                                                                                     |
| **NEW** `persist-state.test.ts`        | 392 行 ≤500，18 例（挂载回调恢复 + DOM 反映 / 变更整包保存 / 挂载提交不覆写存储 / storage:false 零 IO / 坏 JSON 自愈 / 非纯对象 / include 双向 / 自定义 key / pageSize 单请求注入 / 无代理跳过 / localStorage 默认适配器 / 配额错误不崩 / 无 prop 零 IO / visibility+order 惰性断言 / 缺失回调双向惰性 / 裸表零写 / remoteSort·remoteFilter 重查） |
| **NEW** `persist-state-ssr.test.ts`    | node pragma（Badge 先例），window 守卫 + server render 冒烟                                                                                                                                                                                                                                                                                        |
| **NEW** `persist-state-harness.svelte` | 受控测试 harness                                                                                                                                                                                                                                                                                                                                   |
| `docs/vxe-grid-comparison.md`          | persistState 能力行补批 EJ 段 + 构建状态行 + 批次表「批 EJ」行                                                                                                                                                                                                                                                                                     |

### 验证结果（全绿）

| 门                        | 结果                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| svelte typecheck          | 0 errors 0 warnings                                                                                                       |
| svelte test               | 988 + 35 hydration = **1023/1023**（+19 新）                                                                              |
| svelte lint               | **0 errors 0 warnings**（复杂度重构后清零）                                                                               |
| iris-ui-spec `--mode all` | **0 violations**（无裸值，零 CSS 改动）                                                                                   |
| gen:manifest              | 已重新生成 + `check:manifest` up-to-date：svelte `persistState` native + publicTypes +3，`unavailable=0`；155×4/86 tokens |

### Fiat（baseline 决定、已落实）

- **F1**：spec 六块中 columnVisibility/columnOrder 在 svelte 无 change 通道 → 恒惰性（永不收集/永不回放，测试 ⑭ 断言而非跳过）
- **F2**：pageSize 保存门不对称镜像（代理即收集、`onPageChange` 才恢复）
- sort 恢复复用提取出的 `applySort` 同一咽喉（受控/非受控 + remoteSort 重查）

### 剩余

- vue/solid 的 persistState 对齐仍待后续批（本次仅 svelte）
- columnVisibility/columnOrder 恢复通道（需先补 `onColumnVisibilityChange`/`onColumnOrderChange` 适配器方渠道）属后续批范围（baseline F1 开放问题）
- 会话前既有未提交改动（aero-platform-console / pnpm-lock / DECISIONS.md）保持不动
