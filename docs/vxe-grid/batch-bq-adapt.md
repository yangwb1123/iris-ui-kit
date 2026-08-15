Done. Committed as `<commit>`.

## 批 BQ 完成报告 — 编辑自动保存 `editAutosave` / `onAutosave`（iris 独有）

**实现**（按 baseline 方案零偏差，纯 additive、core 零改动、react-only、纯回调零 UI/i18n）：

- **`props.ts`** — `editAutosave?: boolean`（特性开关）+ `onAutosave?: (rows: Row[]) => void`（父持久化钩子，单行函数 prop），位于 `onEditClosed` 之后编辑组内（156→158 行）
- **`Table.tsx` 3 触点** — ① destructure `editAutosave`/`onAutosave`；② ref 镜像 `editAutosaveRef`/`onAutosaveRef`（commitValue 被 `cellEdit` 的 `useMemo([])` 闭包捕获，`auditEnabledRef` 同构——prop 更新后不取陈旧闭包）；③ 单一咽喉 `commitValue` 末尾门控触发：`if (editAutosaveRef.current) onAutosaveRef.current?.(autosaveRows(ctx, k, value))`，payload = 提交后行列表（标准 rowKey 行靠 eager 块同步的 `externalDataRef`；rowId 行 8 行 `autosaveRows` helper 逐字镜像 `setLiveData` updater 的 fallback——按计算键定位行、克隆、置值）

**fiats（全部按 baseline）**：`editAutosave` 是特性开关、`onAutosave` 单独无效果（keymap 先例）；`value === oldValue` 早退天然覆盖 no-op 不触发；校验失败/Escape 不触发；async 校验落地时触发一次；row 模式逐列提交逐列触发（载荷累积）；与 `onDataChange` 正交（inline 编辑从不触发 onDataChange，onAutosave 精确填补父持久化钩子缺口）；row-list 类写回（paste/fill/FNR/批量）不触发

**测试**：新 `edit-autosave.test.tsx` **12 用例**（12 passed）— 规格两项打头：①双击→改值→Enter 触发且载荷为新行列表、②有 `onAutosave` 无 `editAutosave` 不触发；外加 no-op 不触发 / 校验失败不触发而随后有效提交触发（async 落地 waitFor）/ Escape 不触发 / Tab 提交触发且焦点移动 / row 模式逐列提交逐列触发（载荷累积）/ 双回调正交（onDataChange 零调用）/ 连续编辑累积（每次载荷为全量当前列表）/ async 校验落地恰一次 / rowId 行 payload 按计算键定位 / 迟到 onAutosave prop 更新仍生效（ref 镜像）

**文件变更**（5 committed + 1 新增测试）：`props.ts` · `Table.tsx` · `edit-autosave.test.tsx`(新) · `manifest.json` + `llms.txt`（gen:manifest 重新生成，propCount 156→158、eventCount 29→30，`onAutosave` 入事件表）· `docs/vxe-grid-comparison.md`（独有表行/构建状态/测试计数 3 处）

**验证**（全部 ✅）：

| 门                       | 结果                                                                         |
| ------------------------ | ---------------------------------------------------------------------------- |
| core test                | 1517/1517                                                                    |
| react typecheck          | ✅                                                                           |
| react test               | **2267/2267**（+12）                                                         |
| react lint               | 0 errors（1 个既有 complexity warning，与批 BP 相同，pre-existing）          |
| spec `--mode all --json` | **0 violations**                                                             |
| gen:manifest             | ✅ 155 组件、react Table propCount **158**、eventCount **30**、llms.txt 同步 |

**剩余**：vue/solid/svelte 对齐留待后续批（react-only 批范围）；批 runner 后置 review/gate 阶段。
