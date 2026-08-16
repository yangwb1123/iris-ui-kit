All done. Final report:

## Report

**Commits**:

- (new) `feat(table): grid 批 CI——行克隆 cloneRow（iris 独有）`
- (new) `docs(table): batch CI adapt report + baseline`

**Files changed** (2 source + 2 test + manifest; ≤4 + tests met):

- `packages/core/src/table-rows.ts` (+26): new pure `cloneRowInList(rows, rowKeyField, key, index?)` — reuses the file's `nextAutoId`, same contract as the insert/remove/update trio (immutable; returns the ORIGINAL array reference when no row matches). Clone = `{ ...source, [rowKeyField]: nextAutoId(...) }` — shallow-copies ALL field values onto a new object; fresh auto id = max numeric key + 1 (string keys never participate), so key addressing / selection / dirty-point tracking stay sound. Default insert position = **right after the source row (sourceIndex + 1)**; explicit `index` clamped into `[0, rows.length]` like `insertRowInList`.
- `packages/core/src/index.ts`: `cloneRowInList` added to the `table-rows` export line.
- `packages/react/src/primitives/table/types.ts`: `cloneRow: (key: string | number, index?: number) => void` added to `IrisTableHandle` right after `insertRow` (single-line, JSDoc'd).
- `packages/react/src/primitives/table/Table.tsx` (+6): import + handle wiring — `const next = cloneRowInList(rows, rowKey, key, index); if (next !== rows) commitRowList(next, 'insert')` — one funnel inherits ALL side effects: `onDataChange` exactly once, undoable, audit/version-history `type: 'insert'`, clone NOT selected (insertRow precedent).
- NEW `packages/core/src/table-rows.test.ts` cloneRowInList block — **9 tests**: ①克隆内容（全字段 + 新 auto id + 新对象）+ 默认插入位置（源行之后）、②末行克隆追加到末尾、③首行克隆插到 index 1、④显式 index（含插到源行之前）、⑤越界钳制、⑥缺键 no-op 原引用（含空列表）、⑦其余行对象身份保持、⑧字符串 key → 数值 auto id 从 1 起、⑨非 max 源行 → 仍取 max+1。
- NEW `packages/react/src/primitives/table/test/clone-row.test.tsx` — **14 tests / 203 lines** (≤500): spec 两块强制内容显式映射——① 克隆内容 → T1（全字段复制 + 新 key）/ T2（非 max 行仍得 max+1）/ T13（repeated clones 每次 max+1 唯一键）/ T14（getData 新列表 + 源数组不动）；② 插入位置 → T3 默认紧跟源行 / T4 显式 index / T5 末行追加。另覆盖：T6 缺键静默（无行无 onDataChange）、T7 onDataChange 恰一次 + 完整新列表、T8 选择不动（克隆不选中、源选中保持）、T9 undo 一次撤销克隆、T10 audit 恰一条 `type: 'insert'` + 克隆 rowKey、T11 脏点语义（源行脏点不动、克隆干净、含已提交值）、T12 集成（updateRow/removeRow 按新 key 寻址、删源克隆存活）。
- `packages/manifest/{manifest.json,llms.txt}` — regenerated & committed（零 diff：155 组件 ×4 不变；propCount **169** / eventCount **31** 不变——handle 方法不入 manifest，batch BF/CI 先例）。

**Counts**: core 1533→**1542** (+9) · react 2467→**2481** (+14) · manifest propCount **169** unchanged · spec **0 violations**.

**Verification** (all ✅): core test 1542/1542 · react typecheck · react test 2481/2481 · react lint **0 errors** (1 pre-existing IrisTable complexity warning, unchanged at 284) · `iris-ui-spec.py --mode all --json` **0 violations** · `gen:manifest` regenerated（零 diff）· prettier clean · framework-free invariant holds（0 framework imports in core，grep 验证）。

**What is left**: runner's review/gate stage. Pre-existing, untouched: `arch-check:ratchet` red on the committed baseline (stale baseline — see prior adapt reports), prior-stage doc dirt (`DECISIONS.md`, `batch-ch-gate.md`). No baseline open questions.
