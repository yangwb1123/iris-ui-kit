Gate complete. Final report:

## 批 N Gate — PASS ✅

**Review verdict:** PASS（1 MINOR / 4 INFO，均非阻塞）

### Full repo gate

- `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks**（135 cached）✅
- `pnpm audit` → **0 vulnerabilities** ✅
- `pnpm gen:manifest` → **155 components**（react/vue/solid/svelte 全对齐；+1 from batch N）+ 86 tokens → `manifest.json`/`llms.txt` 已重生成并提交 ✅

### Doc update (`docs/vxe-grid-comparison.md`)

- 现状对比表新增/更新 4 行，标记 **react 完成**：
  - **固定高度**（`height/minHeight/maxHeight` + sticky 表头）
  - **汇总**（`footerMethod` ✓，替换全局 summary 行，组内汇总保留）
  - **表头/表尾对齐**（`headerAlign`/`footerAlign`，prop > col.align > 默认）
  - **悬停高亮**（`highlightHoverRow`，默认开）
- 构建状态表新增「批 N」行；测试统计行更新

### Commit

```
1b82b39400f3affb342fca9aa52386cb25c4939e
feat(table): vxe-grid 批 N——表格高度/表头表尾对齐/表尾计算方法/悬停高亮（react only）
```

13 files changed, 590 insertions(+), 64 deletions(-)

### Final test counts

| Scope              | Tests    | Files |
| ------------------ | -------- | ----- |
| @iris-ui-kit/react | **1673** | 152   |
| @iris-ui-kit/core  | 1249     | 81    |
| **Repo total**     | **7249** | —     |

核心零改动（框架无关 grep 通过）；batch N 相关产物（adapt/baseline/review 文档 + 213 行测试）已随提交入库。
