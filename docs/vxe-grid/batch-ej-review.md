Review complete. Verdict written to `docs/vxe-grid/batch-ej-review.md`.

## 结论：**FAIL**（单阻塞项 + 4 条低危）

**核查过程**：

- 对照 react 参考（`usePersistState.ts` + `Table.tsx` 收集器/恢复门/pageSize 注入）逐段比对 svelte 实现；读取了 `table-persist.svelte.ts`、`IrisTable.svelte` diff、两个新测试文件、harness、types/props/index、manifest diff
- 全部验证实测：core 1597 ✓ · svelte 1023（含 persist 18+SSR 1）✓ · typecheck 0/0 ✓ · lint exit 0 ✓ · audit 0 漏洞 ✓ · `check:manifest` up to date（155×4、svelte persistState native、unavailable 0）✓ · core 零框架 import ✓ · 零 CSS 改动 ✓

**发现**：

1. **W2（阻塞）** `persist-state-harness.svelte` 违反仓库 `format:check` 合并前置——prettier 要求 `query?` 单行、`columns={columns}`→`{columns}` 简写、EOF 换行；提交内文件集唯一失败项（同目录既有 harness 已符合）
2. **W3** filters/columnWidths 恢复门比 react 多一重 `Array.isArray` 拒绝（失败闭合方向，行为非字节一致）
3. **W3** 非受控 mode sort 恢复经 `applySort` 咽喉会写内部态（react 只发回调）——baseline 授权 fiat，更功能化但未钉测试
4. **W3** `table-persist.svelte.ts:43` 注释声称「与 views 共享守卫」不实（svelte views 走 core `readTableViews`）
5. **INFO** columnVisibility/columnOrder 恒惰性 = baseline F1 已授权、测试断言

语义与卫生全部通过，仅 F1 格式门需修复后放行。
