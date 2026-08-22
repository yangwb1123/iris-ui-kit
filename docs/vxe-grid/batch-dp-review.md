审查完成。verdict 已写入 `docs/vxe-grid/batch-dp-review.md`。

## 结论：**PASS**（4 条 LOW/INFO，无阻塞）

### 实测验证（独立重跑全部通过）

- DP 专项 `batch-dl-dt.test.tsx` **14/14**（含开态注入 + 关态负向 2 用例）
- core test 104 f / **1597 pass**（core 零变更）；react test 246 f / **2819 pass**
- react typecheck clean；lint **0 errors**（2 条 Table.tsx 既有 complexity warning，非本批次引入）
- `pnpm audit:security` **0 vulnerabilities**；`check:manifest` up to date（155×4 / 86 tokens，无 diff）

### Spec 逐项核对（全部满足）

- `scrollbarThumb?: boolean` opt-in 默认 false（`props/advanced.ts:198`）、根标记关态不输出（`Table.tsx:8070`）
- CSS：8×8px 细条 + `--iris-radius-sm` 圆角 + Firefox `scrollbar-color`（`table-css.ts:153-175`）
- **hover 增强为真实现**：rest `color-mix(in srgb, var(--iris-primary) 60%, transparent)` → hover 全量 primary（baseline 观察① 的 no-op 已修复）
- 覆盖根容器 + `[data-iris-virtual-scroll]`（VirtualScroll.tsx:361 确认真实属性）；`table-css.ts` 为运行时唯一注入源
- 约束：react only、additive only、core 未触、零硬编码色、无 dist/tgz

### Findings（均不阻塞）

1. **LOW** `batch-dl-dt.test.tsx:225-237`：断言了 hover 选择器与 rest color-mix，但未断言 hover 背景为全量 primary 及顺序——hover 若回退为与 rest 相同仍会绿。建议断言 hover 块内容。
2. **LOW** `styles.ts:295`：`TABLE_ROW_CSS` 孪生副本缺 DP 规则（观察②），仅 density-toggle 排序测试消费，留待后续单源化。
3. **INFO** thin + scrollbarThumb 同时开启时 cross-browser 宽度不一致（未定义组合）。
4. **INFO** commit `107bf8af` 夹带前序会话的 `batch-do-gate.md` 改写（文档级，证据链完整）。

其余审查内容：commit `107bf8af` 5 文件（CSS 细化 + 强化断言 + docs），`git show --check` clean，manifest 无 hand-edit、正则化后无 diff——全部与实际实现一致。
