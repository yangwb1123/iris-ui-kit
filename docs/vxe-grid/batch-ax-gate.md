Gate PASS。评审 PASS（3 项非阻塞发现），2 项 MEDIUM + 1 项 LOW 全部修复，全仓 gate 复跑通过，已提交。

## 修复内容（review 3 项发现）

1. **MEDIUM — `IrisTableConditionalStyle` 未导出、prop 用内联重复类型**：`packages/react/src/primitives/table/index.ts` barrel 补导出；`props.ts` 改引 `IrisTableConditionalStyle<Row>[]` 替换内联重复（消除双真相源）；`gen:manifest` 后该类型进入 manifest types 列表
2. **MEDIUM — 指南页未注册 VitePress sidebar**：`apps/docs/.vitepress/config.ts` en Guide sidebar 补 `Table conditional formatting` 链接（与 registry-marketplace 同款 en-only 模式，zh 无对应页）
3. **LOW — 无编辑+条件格式测试**：`conditional-styles.test.tsx` 新增 1 测试（可编辑单元格匹配规则 → 双击开编辑器、编辑器保持 `--iris-background` 不透明、规则样式在编辑中存活）

## 额外修复（gate 复跑发现）

- **core lint 2 错误**：AX 提交自带 `conditional-styles.test.ts` spy 谓词未用参数（`row`/`value`）→ 改 `when: () => …`，lint 0 errors（剩余 7 条为既有 complexity warning）

## 全仓 gate

| Check                                                 | Result                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| `turbo run test typecheck lint build --concurrency=2` | ✅ **180/180 tasks**                                          |
| `audit:security`                                      | ✅ **0 漏洞**                                                 |
| `gen:manifest` + `check:manifest`                     | ✅ up to date（155×4, +IrisTableConditionalStyle）            |
| `check:docs-reference`                                | ✅ up to date（155 组件）                                     |
| `audit:tokens`                                        | ⚠️ 既有 warning 集（review 已在 parent 验证同集，无 AX 引用） |
| prettier check（改动文件）                            | ✅ 全部通过                                                   |

## 最终测试计数

- **core：1417**（+6，AX 新增）
- **react：2054**（+1 本 gate 新增编辑+条件格式测试；review 时为 2053）
- **vue：1531** · registry 10 · icons 29 · eslint-plugin 10 · tokens 24

## 提交

```
1f820da6 feat(table): grid 批 AX——单元格条件格式（when 谓词 + 样式规则）
```

报告已写入 `docs/vxe-grid/batch-ax-gate.md`，工作树干净（含 review/adapt 流水线产物与 DECISIONS 一并入库）。
