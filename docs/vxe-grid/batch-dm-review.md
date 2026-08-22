**Verdict: PASS** → 已写入 `/home/u1/iris-ui/docs/vxe-grid/batch-dm-review.md`

## 审查摘要

批次 DM（表格状态自动保存）是"验证式 adapt"——功能在 `61ec5418` 已交付，本批提交 `ef13c225` 只补了 manifest 卫生（barrel 导出 `IrisTableAutoSaveStateConfig` + 重生成 manifest，3 文件 +3/−1）。逐项核验：

**规格正确性** ✅

- `props/editing.ts:286` prop 在 `persistState`(:283) 后；`types/base.ts:110-116` 类型是 spec 的结构超集
- 定时写 `Table.tsx:1489-1498`：setInterval，快照 = 收集器减 `multiSortState`，与 `exportStateJson`(:3698) 逐字同源
- 恢复 `Table.tsx:1479-1485`：effect 体内首 tick 前，走 `applyViewSnapshotRef` 共享门控 / 类型守卫失效惰性
- 独立键 `iris-table-auto-state`；fail-closed：非正/NaN interval、`storage:false`、SSR → 零 IO

**门禁命令全部通过**

- core test：104 files / **1597 tests** ✅
- react test：246 files / **2815 tests**（DM 恢复+定时写对在 `batch-dl-dt.test.tsx:54-85`）✅
- react typecheck 0 · lint 0 errors（2 个既有 complexity 警告）✅
- `pnpm audit:security`：0 漏洞 ✅
- `pnpm check:manifest`：up to date（155×4）✅
- core 框架无关 grep 空 · 零 CSS/token 改动 · 仅加法 ✅

**编号发现**（均 LOW/INFO，不阻塞）：

1. `Table.tsx:1466-1500` — restore 随配置变更重跑（含内联 storage 对象每渲染重触发）；注释说 "restore once on mount"，建议 `restoredRef` 门
2. `Table.tsx:1467` — 省略 `intervalMs` 时恢复也被静默禁用（类型/注释措辞有落差）
3. 基线 fail-inert 契约（storage throws / corrupt JSON 等）仅代码审读核验、未测试化
4. 卸载不 flush 最后一段窗口（定时快照设计固有折衷）
