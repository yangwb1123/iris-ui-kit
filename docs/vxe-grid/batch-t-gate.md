Gate complete. Final report:

## 批 T Gate — PASS ✅

**Review verdict**: PASS（4 × LOW 非阻塞发现）

### Gate fixes applied

1. **Lint 阻断** — `handle-events-radio-total.test.tsx` 裸转义 `\"` 触发 `no-useless-escape`（`62:86` error），改为模板字符串，0 errors
2. **`toggleRowExpand` 事件陈旧闭包（F2）** — handle 运行于 mount-time 闭包，`expandedKeys` 快照跨 toggle 过期：第二次调用仍上报 `(row, true)`。改为 `expansion.isExpanded(keyStr)` 活读模型索引（与点击路径 `!expandedKeys.includes(...)` 同一模型语义），新增断言由 review 时 20 tests → 24 tests
3. **测试断言选择器（F1 侧）** — jsdom/nwsapi 拒绝 `"` 键的引号属性选择器（`querySelector` throw），断言改为与实现 jsdom 回退一致的属性扫描定位

F1（`CSS.escape` + 属性迭代回退）与 F2 主体（事件触发 + `rowExpandable` 门）在 adapt 实现中已就位；本次仅补上事件参数的活读语义。F3（radio 无 name）/F4（文档测试数）为既有语义/文档事实，非阻断。

### Full gate results

| 门                                                    | 结果                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | **180/180 tasks**（4m05s）                                                                   |
| React tests                                           | **1778/1778**（原 1754 + 24 新）· typecheck 0 · lint 0 errors（1 个既有 complexity warning） |
| `pnpm audit`                                          | **0 vulnerabilities**                                                                        |
| `gen:manifest` + `check:manifest`                     | 155 组件 × 4 框架对齐（86 tokens），up-to-date ✅                                            |

### Docs

- **comparison doc**：`选择`（radio 单列）、`分页配置`（showTotal 总数）、`表格方法`（scrollToRow/toggleRowExpand/clearSort/clearFilter/setCurrentRow/setCurrentColumn）、新增 `事件` 行（cellDblClick/rowDblClick/headerClick/expand）均标记 ✅（react）；批 T 构建行；总数刷新（react 1778 · core 1249 · 7354 total）
- DECISIONS.md 追加 gate 条目（含 commit 哈希）
- 移除 adapt 遗留的 `scratch-debug.test.tsx`（调试废码，非交付物）

### Commit

**`<commit-hash>`** — `feat(table): vxe-grid 批 T——表格方法/事件补齐/radio 列/分页总数（react only）`
