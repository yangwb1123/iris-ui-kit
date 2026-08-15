All gates green. Final report:

## 批 BQ 完成报告 — 编辑自动保存 `editAutosave` / `onAutosave`（iris 独有）

Committed as **`c6850f5c`** — `feat(table): vxe-grid 批 BQ——编辑自动保存 editAutosave/onAutosave（iris 独有）`

### 实现（baseline 零偏差，纯 additive、core 零改动、react-only、纯回调零 UI/i18n）

**`props.ts`** (+4)：`editAutosave?: boolean`（特性开关）+ `onAutosave?: (rows: Row[]) => void`（父持久化钩子，单行函数 prop），`onEditClosed` 后编辑组内（props.ts:349 之后）。

**`Table.tsx` 3 触点** (+35)：

- destructure `editAutosave`/`onAutosave`
- ref 镜像 `editAutosaveRef`/`onAutosaveRef`（commitValue 被 `cellEdit` 的 `useMemo([])` 闭包捕获，`auditEnabledRef` 同构——prop 更新后不取陈旧闭包）
- **单一咽喉 `commitValue` 末尾门控触发**：`if (editAutosaveRef.current) onAutosaveRef.current?.(autosaveRows(ctx, k, value))` — payload = 提交后行列表（rowKey 行靠 eager 块同步；rowId 行 `autosaveRows` 8 行 helper 逐字镜像 updater fallback）

**fiats**：`onAutosave` 单独惰性（keymap 先例）；`value === oldValue` 早退覆盖 no-op；校验失败/Escape 不触发；async 校验落地恰一次；row 模式逐列触发（载荷累积）；与 `onDataChange` **正交**（inline 编辑从不触发 onDataChange）；row-list 写回（paste/fill/FNR/批量）不触发。

### 测试（12 用例，338 行 ≤500）

`edit-autosave.test.tsx`（新）— 规格两项打头：①双击→改值→Enter 触发且载荷为新行列表、②有 `onAutosave` 无 `editAutosave` 不触发；+ no-op / 校验失败→随后有效提交 / Escape / Tab / row 模式逐列 / 双回调正交 / 连续编辑累积 / async 落地恰一次 / rowId 分支 / 迟到 prop 更新仍生效。

### 验证（全部 ✅）

| 门                            | 结果                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------------- |
| core test                     | 1517/1517                                                                                          |
| react typecheck               | ✅                                                                                                 |
| react test                    | **2267/2267**（+12）                                                                               |
| react lint                    | 0 errors（1 既有 complexity warning，pre-existing）                                                |
| spec `--mode all --json`      | **0 violations**                                                                                   |
| gen:manifest + check:manifest | ✅ 155 组件 · propCount **156→158** · eventCount **29→30**（`onAutosave` 入事件表）· llms.txt 同步 |

### 文件变更（9 committed）

`props.ts` · `Table.tsx` · `edit-autosave.test.tsx`(新) · `manifest.json` + `llms.txt`（重新生成）· `docs/vxe-grid-comparison.md`（独有表行/构建状态/测试计数 3 处）· `batch-bq-adapt.md`(新) · `batch-bq-baseline.md` + `DECISIONS.md`（runner 已写，随批提交）。未触碰 dist/tgz/node_modules、未手改 manifest.json。

### 剩余

- vue/solid/svelte 对齐留待后续批（react-only 批范围）
- 批 runner 后置 review/gate 阶段（`docs/vxe-grid/batch-bp-gate.md` 的 runner 预存改动保持未提交，非本批内容）
