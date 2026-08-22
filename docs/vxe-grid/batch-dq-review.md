## Verdict: **PASS**（2 × P3 + 1 × INFO，无阻断）

Review written to `docs/vxe-grid/batch-dq-review.md`. 逐项核对结果：

**Verified（实跑）**

- core test **1597/1597**（104 files），core 零改动；框架无关 grep 0 条
- react test **2822/2822**（246 files），batch-dl-dt **17/17**（含本批次 +3 DQ 用例）
- react typecheck 0 errors · lint 0 errors（2 条 Table.tsx 既有 complexity warning，非 DQ 引入）
- `check:manifest` up to date（155×4 / 86 tokens，零 drift）· `iris-ui-spec.py` 0 violations / 1535 files · `audit:security` 0 漏洞

**Spec correctness** — 全部锚点对齐：类型形状逐字一致（`types/base.ts:118-124`）、opt-in 默认 undefined、`externalRowDropAt` 命中链（elementFromPoint→closest→attribute 匹配→每事件最新 prop）、leave 豁免 + 窗口监听接管、命中清线、释放分流恰一次 onDrop 且不落 onReorder、未命中原表内重排。双重派发安全经 core `end()` 幂等性确认。

**Additive-only** — DQ commit 仅 index.ts +1 类型出口、editing.ts 注释单行化、测试 +101 行、manifest 重生成；Table.tsx/其他框架/样式零改动，无 unavailable 占位。

**Findings（均非阻断）**

1. **P3** — `batch-dl-dt.test.tsx:243-374` DQ 用例用 `Object.defineProperty` 打桩 `document.elementFromPoint`，恢复只在用例末尾手动执行，断言失败会泄漏 stub（`vi.restoreAllMocks()` 不覆盖）→ 建议 `vi.spyOn` 或移入 `afterEach`
2. **P3** — `Table.tsx:2563-2581` 窗口监听闭包捕获 `rowDrag`/`bodyData` 但 deps 只列 `[rowDragActiveId, rowDragBetween]`；当前靠冒泡顺序（root 新闭包先提交）和幂等 end() 兜底不可达，属脆性耦合 → 建议改经 refs 取最新值或补 deps
3. **INFO** — commit 顺带沉淀了既往批次文档（流水线票据性质，纯文档无代码影响）
