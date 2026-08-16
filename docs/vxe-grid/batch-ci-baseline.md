Baseline complete — written to `/home/u1/iris-ui/docs/vxe-grid/batch-ci-baseline.md` (42 lines). Zero source files touched; git status shows only the pre-existing prior-stage dirt (`DECISIONS.md`, `batch-ch-gate.md`) plus the new baseline, HEAD `57677bda`.

## Baseline essence (batch CI：行克隆 cloneRow — iris 独有)

**Spec**: `handle.cloneRow(key: string | number, index?: number): void` —— 复制指定行（含所有字段值）插入；测试（克隆内容/插入位置）。vxe-grid 无克隆行 API（批 E insert/remove 家族之外的新成员）→ 无 parity 约束，纯 iris 独有增量。

**Design** — 一个新 core 纯函数 + 一个 handle 方法，零新 prop / 零 i18n / 零样式 / 零事件：

- **Core** `cloneRowInList(rows, rowKeyField, key, index?)` in `table-rows.ts`，复用文件内 `nextAutoId`，与 insert/remove/update 三兄弟同契约（不可变、无匹配返回原引用）。克隆 = `{ ...source, [rowKeyField]: nextAutoId(...) }`——浅拷贝全部字段值（insertRow 同款数据契约），key 必换新（max 数值 key + 1，字符串 key 不参与），否则破坏 rowKeyOf/选择/脏点寻址；**默认插入位置 = 源行之后（sourceIndex + 1）**，显式 index 按 `insertRowInList` 先例钳入 `[0, length]`。
- **Handle 接线**（`Table.tsx` handleRef 紧跟 `insertRow`）：`const next = cloneRowInList(...); if (next !== rows) commitRowList(next, 'insert')` —— 一次漏斗继承全部副作用：`onDataChange` 恰一次、undo 可撤销、审计/版本历史 `type: 'insert'`。
- **边界**：克隆不选中（insertRow 先例）；脏点按行 key 寻址 → 克隆新身份渲染干净、源脏点不动；`rowId` 独有键行不可寻址（与 remove/update 家族文档化限制一致）。
- **零改动**：props.ts / 审计枚举 / i18n / styles / solid·vue·svelte / TableBody；manifest 不可见（batch BF 先例）→ propCount 169 / eventCount 31 不变。

**File map**: `core/table-rows.ts` · `core/index.ts`(:373) · `core/table-rows.test.ts` · `react/.../types.ts`(:565 handle 方法) · `Table.tsx`(:4981 接线) · NEW `test/clone-row.test.tsx` · manifest 重新生成（零 diff）· gate 阶段 comparison doc 新增行。

**Test plan**: spec 两块强制内容显式映射——① 克隆内容（核心 #1 / react T1、T2）、② 插入位置（核心 #2 / react T3 默认紧跟源行、T4 显式 index）；核心 9 例（含缺键 no-op、钳制、字符串 key auto id、身份保持）+ react 13 例（缺键静默、max+1 键分立、onDataChange 恰一次、选择不动、undo/audit insert 类型、脏点语义、集成 update/remove、末行追加）。预期 **react 2467→2480** · **core 1533→1542**。
