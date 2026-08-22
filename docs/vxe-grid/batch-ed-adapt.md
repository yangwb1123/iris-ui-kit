Done. Full report:

## 批 ED：对比一键合并（iris 独有）— complete

**Spec implemented**: `mergeCompare?: boolean` — when on (with `compareWith` + `rowKey`), the toolbar gains a text-label button `data-iris-table-compare-merge` applying every `added`/`changed` difference to the current data via `commitRowList(rows, 'merge')`. Changed rows are replaced in place by their snapshot version (shallow copy — never aliased), added rows appended in snapshot order; `removed` untouched (spec: changed/added only). Disabled when nothing to apply; handler early-returns (double-safety, idempotent).

**Files changed (8 + new test)**:

| File                                          | Δ                                                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/audit-log.ts`              | `AuditLogType` union + doc: `'merge'` member (no exhaustive switch anywhere)                                                                |
| `packages/core/src/i18n-messages.ts`          | `'table.mergeCompare': 'Merge compare'`                                                                                                     |
| `packages/plugin-locale-zh/src/core/index.ts` | `'table.mergeCompare': '合并差异'` (zh-coverage test requires it)                                                                           |
| `packages/react/.../props/advanced.ts`        | `mergeCompare?: boolean` + JSDoc                                                                                                            |
| `packages/react/.../Table.tsx`                | prop destructure · toolbar gate `\|\| mergeCompare` · merge button after the undo cluster                                                   |
| `packages/react/.../types/handle.ts`          | `IrisTableAuditEntry`/`IrisTableVersionEntry` `type` members widened to core `AuditLogType` (forced by typecheck after the union extension) |
| `packages/manifest/{manifest.json,llms.txt}`  | regenerated (`gen:manifest`, ALWAYS) — **208 props** (baseline predicted ED → 208), react-only                                              |
| `packages/react/.../test/batch-ed.test.tsx`   | **new, 297 lines, 22 tests**                                                                                                                |

**Tests added (22, per baseline plan)**: 门控 5 (off → no toolbar; no compareWith → toolbar, no button; empty rowKey guard; identical snapshot disabled; removed-only disabled) · 合并结果 9 (in-place replace + non-alias; snapshot-order append; removed untouched; unchanged ref-preserved; empty-live all-append; null-key snapshot/live skips; idempotent second-click; attrs flip) · 通道 5 (onDataChange; single audit `merge` entry; undo restores; version restore; selection preserved) · 契约 3 (attr+label; en override; zh 合并差异).

**Verification (all green)**:

- `--filter @iris-ui-kit/core test` → 1641/1641 ✓ (core rebuilt — dist is gitignored, not tracked)
- `--filter @iris-ui-kit/react typecheck` ✓ / `test` → 3012/3012 (257 files, batch-ed 22/22) ✓ / `lint` → **0 errors** (2 pre-existing complexity warnings) ✓
- `iris-ui-spec.py --mode all` → **0 violations** ✓
- `pnpm gen:manifest` → regenerated + committed to git ✓
- plugin-locale-zh 6/6 (every-builtin-key guard) ✓; prettier clean ✓

**Left**: nothing within this batch's scope — manifest hygiene held (single-line prop, named interfaces, no new types); next stage is the review/gate.
