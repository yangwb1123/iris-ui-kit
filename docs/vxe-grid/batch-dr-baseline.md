Baseline 完成。仅写的文件：`/home/u1/iris-ui/docs/vxe-grid/batch-dr-baseline.md`（`DECISIONS.md`、`batch-dq-gate.md` 为工作区既有改动，未触碰；零源码修改）。

## Baseline summary — 批 DR：单元格编辑快捷键（iris 独有）

**Exact design** — spec（`editKeys?: Array<'F2' | 'Enter' | 'Space'>`，可编辑单元格聚焦时按这些键进入编辑；默认 F2；配置扩展；测试自定义键编辑）**已在 HEAD `2a413bdd` 完整提交**（`61ec5418` adapter 对齐重构内随 DL–DT 批次落地，DECISIONS.md:2748 有批记录），逐行锚定：

- **prop**：`props/editing.ts:230-234`——字面联合类型逐字匹配 spec，默认 undefined（opt-in；缺省走既有 AN `tableShortcuts` F2 路径）
- **门禁**：`Table.tsx:4400-4416` `handleConfiguredEditKey`——需 `keyboardNavigation` 的 roving focused-cell；编辑器已开、非 grid cell target、`!col.editable`/formula/锁读/只读一律 return；`e.preventDefault()` + `beginEdit(...)`（统一走 `cellEdit.startEdit` + batch V 上报）
- **命中**：`4404-4412` F2 `e.key==='F2'` / Enter / Space 三写匹配（`' '`/`'Spacebar'`/`code==='Space'`）；`!matches && e.key !== 'F2'` → return——**F2 恒保留**（prop 存在时默认键始终可用，配置只做扩展）
- **挂载序**：`8078/8082-8083` 根 onKeyDown 链首分派 + `defaultPrevented` 短路——opt-in Enter 开编辑器而非被 `handleGridKey` 的 Enter=ArrowDown 吞掉；有 editKeys 时 F2 先手遮蔽 AN 同名键（行为等价）；DR 的 F2 为硬编码，不受 BG keymap rebind 影响
- **测试**：`test/batch-dl-dt.test.tsx:376-386`「DR starts editing on a configured key while retaining F2」——`editKeys={['Enter']}` + focus + keyDown → 断言 `[data-iris-table-editor]` 出现

**File map**：prop 1（经 props.ts/types.ts 公共出口）+ Table.tsx 4 touch points + 测试 1，零 core/其他框架/i18n/样式改动，无新增类型文件。

**Test plan**：实跑 3 套件 **38/38 绿**——batch-dl-dt 17/17（含 DR）、Table.shortcuts 13/13（AN F2 默认路径）、keyboard-extra 8/8（grid Enter 语义）；React 2815/2815 全绿记录在案。

**3 条 non-blocking 观察**：① F2 保留/Space 三写匹配/失焦·只读·锁定·公式拦截/无 keyboardNavigation 惰性/与 BG keymap 并存均无独立断言；② `editKeys={[]}` 时 handler 激活但仅 F2 可用，此边界无测试；③ 有 editKeys 时 DR 先手遮蔽 AN F2，组合行为等价但无显式测试。
