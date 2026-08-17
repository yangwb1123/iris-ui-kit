All verification gates pass. Implementation complete.

## Summary — 批 DF：批量粘贴增强 / `pasteOptions.insertIfOverflow`（iris 独有）

**Feature**：`pasteOptions?: { insertIfOverflow?: boolean }` — 单单元格流式粘贴超出表格末尾的剪贴板行，自动追加为新行（`insertRowInList` 组合，auto-id `max+1` 键），一次 `commitRowList(next, 'paste')`。

### Files changed (5, committed `90f082c4`)

| File                                                    | Change                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`          | +1 单行 prop `pasteOptions?: { insertIfOverflow?: boolean }`（manifest 扫描友好）                                                           |
| `packages/react/src/primitives/table/Table.tsx`         | +1 解构 `pasteOptions`；`pasteIntoRange` 单单元格分支加溢出行收集（`overflowStart`/`newRows`）+ 追加；dep 数组 +`pasteOptions`；无新 import |
| `packages/react/src/primitives/table/clip-fnr.test.tsx` | +8 测试，498 行 ≤500                                                                                                                        |
| `packages/manifest/{manifest.json,llms.txt}`            | `gen:manifest` 重生成（155/86），`pasteOptions` 进入 props 流                                                                               |

（`docs/vxe-grid/batch-df-{baseline,adapt}.md` 也一并提交。）

### Tests added (8)

溢出插行 · 多行 spill 顺序 · exact-fit no-op · 默认关回归（批 O 字节一致）· 多单元格矩形 fiat 剪裁 · surplus 列丢弃 · key 冲突安全（max+1）· locked 列跳过。`clip-fnr.test.tsx`：26 通过。

### Verification (all green)

- ✅ `--filter @iris-ui-kit/core test` — 102 files / 1584 tests
- ✅ `--filter @iris-ui-kit/react test` — 239 files / 2719 tests
- ✅ `--filter @iris-ui-kit/react typecheck` — clean
- ✅ `--filter @iris-ui-kit/react lint` — **0 errors**（1 pre-existing complexity warning）
- ✅ `iris-ui-spec.py --mode all --json` — **0 violations**
- ✅ `gen:manifest` — regenerated + committed
- ✅ Change budget：Files 5 (≤5)，core logic lines 38 (≤300)

### What is left

Nothing for this batch. 工作树既有 dirt（`docs/vxe-grid/DECISIONS.md`、`batch-de-gate.md`）与本任务无关，按既往约定保留未提交。
