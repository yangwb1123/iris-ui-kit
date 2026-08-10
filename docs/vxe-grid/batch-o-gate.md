Gate complete. Final report:

## 批 O Gate — PASS ✅

**Review verdict: FAIL**（1 MAJOR + 3 MINOR + 4 INFO）→ 全部修复后全门通过

### Review fixes applied

1. **MAJOR** — `props.ts` 新增 `clipConfig`/`fnr` 后 manifest 未重生成 → `pnpm gen:manifest` 重生成 `manifest.json`/`llms.txt`（diff = 恰 2 个新 prop，propCount 91→93），`pnpm check:manifest` 通过 ✅
2. **MINOR** — `Table.tsx` window 级 Ctrl+C/V 仅豁免 INPUT/TEXTAREA，非表格元素上会被劫持 → 加 `rootRef.current?.contains(target)` 守卫 ✅
3. **MINOR** — tagName 守卫漏 `<select>` 编辑器 → 与 fnr 处理器一致改用 `dataset.irisTableEditor` 检查（三种编辑器均携带）✅
4. **MINOR** — 查找条 Enter 处理器对任意 target `preventDefault`（替换输入框 Enter 被吞、按钮 Enter 失效）→ 限定 `data-iris-fnr-find` 输入框 ✅

### Full repo gate

- `turbo run test typecheck lint build --concurrency=2` → **180/180 tasks**（54 cached）✅
- `pnpm audit` → **0 vulnerabilities** ✅
- `pnpm gen:manifest` → **155 components**（react/vue/solid/svelte 全对齐）+ 86 tokens；`pnpm check:manifest` → "up to date" ✅

### Doc update (`docs/vxe-grid-comparison.md`)

- 现状对比表新增 2 行，标记 **react 完成**：
  - **范围复制**（`clipConfig`：Ctrl+C 范围导出 TSV / Ctrl+V 粘贴回写，公式中和，溢出忽略，行键映射排序/筛选/代理安全）
  - **查找替换**（`fnr`：Ctrl+F 查找条 + 高亮 + Enter/Shift+Enter 步进 + 替换/全部替换单次提交，Esc 关闭）
- 第 10 节交互增强清单同步标注批 O ✓
- 构建状态表新增「批 O」行；测试统计行更新（react 1687 · total 7263）

### Commit

```
f26b40a4104bfdf57860ee56eb560b660b0d6b19
feat(table): vxe-grid 批 O——单元格复制/查找替换（react only）
```

12 files changed, 885 insertions(+), 56 deletions(-)

### Final test counts

| Scope                         | Tests    | Files |
| ----------------------------- | -------- | ----- |
| @iris-ui-kit/react            | **1687** | 153   |
| @iris-ui-kit/core             | 1249     | 81    |
| @iris-ui-kit/plugin-locale-zh | 6        | 1     |
| **Repo total**                | **7263** | —     |

核心零改动（框架无关 grep 通过）；batch O 相关产物（adapt/baseline/review/gate 文档 + 283 行测试）已随提交入库。
