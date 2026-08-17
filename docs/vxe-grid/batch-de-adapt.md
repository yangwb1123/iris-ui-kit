Done. All verification gates pass.

## Implementation — 批 DE：表格状态对比（iris 独有）

**`handle.compareStates(a: string, b: string): string`** — 纯加法 handle 方法，对比两个导出状态 JSON 并返回字段级差异文本。

### Files changed (4, all committed `b4f8b6d`)

| File                                                               | Change                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/compareStates.ts` (NEW)       | 纯框架无关模块：`deepEqual`（排序键 + 结构深等，顺序无关）+ 递归 `collectDiff`。`+` 新增 / `-` 移除 / `~ old → new`（a=前,b=后）；对象块 desc 点路径 `sort.direction`，record map 按 key `columnWidths.name`，数组按 index `columnOrder[0]`；相同 → `''`；无效 JSON → `! compareStates: invalid JSON`（不抛） |
| `packages/react/src/primitives/table/compare-states.test.ts` (NEW) | 14 个纯 vitest 断言（T1–T11 全景 + 排序确定性 + 方向性 + fail-closed）；T12 render 集成按 baseline 定为可选，跳过                                                                                                                                                                                             |
| `packages/react/src/primitives/table/Table.tsx`                    | +1 import `./compareStates`；+1 handle 方法 `compareStates: (a, b) => compareStatesDiff(a, b)`（沿用 exportCsv 独立 stdlib 先例，不膨胀 god-file）                                                                                                                                                            |
| `packages/react/src/primitives/table/types.ts`                     | +1 单行 JSDoc 方法 `compareStates: (a: string, b: string) => string`（manifest 扫描友好）                                                                                                                                                                                                                     |

### Verification (all green)

- ✅ `--filter @iris-ui-kit/core test` — 102 files / 1584 tests pass
- ✅ `--filter @iris-ui-kit/react test` — 239 files / 2711 tests pass (14 new)
- ✅ `--filter @iris-ui-kit/react typecheck` — clean
- ✅ `--filter @iris-ui-kit/react lint` — 0 errors (1 pre-existing `IrisTable` complexity warning, unchanged)
- ✅ `iris-ui-spec.py --mode all --json` — **0 violations** (exit 0)
- ✅ `gen:manifest` — 155 components / 86 tokens regenerated; **no diff** (new module is no `Iris*` component, no barrel export — baseline intended)

### Change budget

- Files: 4 (target ≤5) · Core logic lines added: 107 (target ≤300) — filesize gate PASS.

### What is left

Nothing for this batch. The optional T12 render-backed `exportStateJson → compareStates → importStateJson` audit-loop integration test was skipped by design (baseline marked it optional; pure module + handle wiring already covered). The pre-existing working-tree dirt (`docs/vxe-grid/DECISIONS.md`, `batch-dd-gate.md`) was left untouched/uncommitted as in prior batches.
