Done. All verification gates pass.

## Implementation — 批 DF：批量粘贴增强 / pasteOptions.insertIfOverflow（iris 独有）

**`pasteOptions?: { insertIfOverflow?: boolean }`** — 纯加法 prop：让单单元格流式粘贴把跑出表格末尾的剪贴板行自动追加为**新行**（`insertRowInList` 组合，auto-id `max+1` 键）。

### Files changed (4 + manifest regenerated)

| File                                                    | Change                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/react/src/primitives/table/props.ts`          | +1 单行 prop `pasteOptions?: { insertIfOverflow?: boolean }`（manifest 扫描友好，紧邻 clipConfig 先例）                                                                                                                                                                                                                  |
| `packages/react/src/primitives/table/Table.tsx`         | +1 解构 `pasteOptions`；`pasteIntoRange` 单单元格分支加溢出行收集（`overflowStart`，`newRows`）→ 超出表尾的行按 `insertRowInList` 顺序追加（surplus 列丢弃、locked/readonly 跳过）；dep 数组 +`pasteOptions`；一次 `commitRowList(next, 'paste')`。多单元格矩形粘贴保持剪裁（fiat），默认关 = 批 O 字节一致。无新 import |
| `packages/react/src/primitives/table/clip-fnr.test.tsx` | +8 测试（T1–T8）：溢出插行、多行 spill 顺序、exact-fit no-op、默认关回归、多单元格 fiat 剪裁、surplus 列丢弃、key 冲突安全（max+1）、locked 列跳过。498 行 ≤500                                                                                                                                                          |
| `packages/manifest/{manifest.json,llms.txt}`            | `gen:manifest` 重生成（155 组件 / 86 tokens；pasteOptions 进入 props 流）                                                                                                                                                                                                                                                |

### Verification (all green)

- ✅ `--filter @iris-ui-kit/core test` — 102 files / 1584 tests pass
- ✅ `--filter @iris-ui-kit/react test` — 239 files / 2719 tests pass (8 new)
- ✅ `--filter @iris-ui-kit/react typecheck` — clean
- ✅ `--filter @iris-ui-kit/react lint` — **0 errors** (1 pre-existing `IrisTable` complexity warning, unchanged)
- ✅ `iris-ui-spec.py --mode all --json` — **0 violations**
- ✅ `gen:manifest` — 155 components / 86 tokens regenerated, pasteOptions present

### 语义 fiat

- 溢出插行只作用于**单单元格流式**粘贴；多单元格矩形粘贴即使开启也保持剪裁（与批 AK 一致）。
- 溢出新行的 locked/readonly 用空行谓词评估（新行无既有数据），静态 locked 完美跳过，动态行级谓词为最佳努力。
- 默认缺省 = 批 O 溢出丢弃，字节一致。

### What is left

Nothing for this batch. 逐行插入是 `insertRowInList` 的既有组合调用（append 到表尾），未改 core。工作树既有 dirt（`docs/vxe-grid/DECISIONS.md`、`batch-de-gate.md`）与批次无关，保留未提交。
