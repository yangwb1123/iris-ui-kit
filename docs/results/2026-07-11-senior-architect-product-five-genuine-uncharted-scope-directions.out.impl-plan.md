Tech Lead 分析报告已写入：`docs/requirements/2026-07-12-tech-lead-five-directions-implementation-analysis.md`（19.8 KB）

## 核心结论

### 任务分解概览（21 个任务，~61 工时）

| 方向                         | 优先级 | 任务数 | 工时 | 核心改动文件          |
| ---------------------------- | ------ | ------ | ---- | --------------------- |
| D1: flattenNav 循环引用      | P0     | 3      | ~8h  | `nav.ts`              |
| D3: parsePath 畸形输入       | P0     | 6      | ~14h | `path.ts` + `form.ts` |
| D4: SelectionModel 索引过期  | P1     | 4      | ~14h | `selection.ts`        |
| D5: Virtualizer Fenwick 缓存 | P1     | 4      | ~13h | `virtualizer.ts`      |
| D2: WindowManager Z-Index    | P1     | 4      | ~12h | `window.ts`           |

### 执行策略

- **5 个方向完全独立**（不同模块，零文件冲突）→ 可完全并行
- **P0 方向（D1+D3）**：Day 1-2 合并到 main，降低后续冲突风险
- **版本号惰性索引**（D4）：推荐方案——纯版本号比较 O(1)，避免 `ReadonlyStore` 破坏现有适配器
- **3 层安全网**（D2）：z-rebalance 阈值触发 + 持久化前重排 + workspace 切换保护

### 关键待决策项（Sprint Day 0）

1. **D3**: `parsePath` 错误策略 → 推荐 **dev throw + prod console.warn**（最小侵入）
2. **D4**: 是否收窄 `store` 接口 → 需先 `grep` 全库确认适配器使用 `store.setState` 的情况
3. **D5**: `getItemKey` 是否 required → 推荐保持 optional + warn（避免 breaking change）
4. **版本号**: → 推荐 **minor** bump（新增 API，非 breaking）
