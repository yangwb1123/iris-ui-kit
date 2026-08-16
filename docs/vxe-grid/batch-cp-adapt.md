All green. Batch CP complete.

## Report — 批 CP：数据密度切换（iris 独有）

### Files changed (2 commits)

**`58555eb2`** — `feat(table): grid 批 CP——数据密度切换（iris 独有）`

| File                                                          | Change                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/primitives/table/props.ts`                | `export type IrisTableDensity = 'comfortable' \| 'compact' \| 'cozy'`（具名导出类型）+ `density?` / `densityToggle?` 单行 props（propCount 174→176，scanner enum 解析成功）                                                                                         |
| `packages/react/src/primitives/table/styles.ts`               | 共享 sheet 在 size 预置后追加 `compact → --iris-cell-pad-y: 6px` / `cozy → 4px`（同特异性后胜，comfortable 无规则字节不变）                                                                                                                                         |
| `packages/react/src/primitives/table/Table.tsx`               | react 实际注入的本地 sheet 同款两规则 · `nextDensity` 模块 helper · `densityState` 本地 state（zoom 先例）+ 非法 fail-closed · 根 `data-density` · 工具栏门 + `data-iris-density-toggle` 循环按钮（`effective = toggle ? state : prop`，i18n 档位文案，token-only） |
| `packages/core/src/i18n.ts`                                   | +4 en 键 `table.density(.comfortable/.compact/.cozy)`                                                                                                                                                                                                               |
| `packages/plugin-locale-zh/src/core/index.ts`                 | +4 zh 键（宽松/紧凑/密集）——en/zh 全覆盖守卫保持绿                                                                                                                                                                                                                  |
| `packages/react/src/primitives/table/density-toggle.test.tsx` | NEW — **12 tests, 192 lines**（≤500 ✓）                                                                                                                                                                                                                             |
| `packages/manifest/{manifest.json,llms.txt}`                  | regenerated：propCount **174→176**、events 31 不变                                                                                                                                                                                                                  |
| `docs/vxe-grid-comparison.md`                                 | 「iris 独有」节 批 CP 行 + 构建状态尾部                                                                                                                                                                                                                             |

**`546c70ff`** — `docs(vxe-grid): batch CP adapt report`

### Tests added (12)

default attr · tier attrs · size 共存 · fail-closed · gate admission · layouts 隐藏抑制 · cycle behavior（3 击 4 态）· seed-once · toggle 胜 prop · 无 toggle 时 prop 生效 · zh label · structural lock（双 sheet 规则 + 位于 size 预置之后 + 纯 CSS 零 inline + var 链）

### Verification (all ✅)

- core test **1559/1559**（仅 i18n 默认键，框架无关 intact）· plugin-locale-zh **6/6**
- react typecheck **clean** · react test **2556/2556**（2544→+12，恰合基线）
- react lint **0 errors**（1 条既有 IrisTable complexity 警告）· spec **0 violations**
- `pnpm gen:manifest` 重新生成并已提交

### Deviation from baseline

基线将密度规则只放 `styles.ts` 的 `TABLE_ROW_CSS`；核查发现 react 注入的是 **Table.tsx 本地副本**（styles.ts 那份无消费方），故规则落两份 sheet 保证 react 真正生效，结构锁测试双查。

### What is left

- runner 的 review/gate 阶段；工作树 `DECISIONS.md`/`batch-co-gate.md` 为既有残留（未触碰）
- vue/solid/svelte 对齐延后（react-only scope）
