Baseline complete — `/home/u1/iris-ui/docs/vxe-grid/batch-at-baseline.md` (307 lines). `git status` confirms only the new doc; zero source files touched.

**Key findings (every claim verified against current code):**

**The spec's mental model needs one correction** — there are **two** write-back funnels, not one:

- `commitRowList` (Table.tsx:2701) — batched ops: 13 call sites (row ops, paste, fill, range clear, fnr, batch edit, undo/redo replay)
- `commitValue` (Table.tsx:1857) — inline cell/row edits **bypass** commitRowList (documented at :1863) and already carry exact context (`rowKeyOf`/`ctx.col.key`/`oldValue`/`value`). Hooking only commitRowList would make the most common mutation invisible to the audit — the baseline hooks both.

**a) Core `createAuditLog<Row>(options?: { limit?: number })`** — new `packages/core/src/audit-log.ts`, cloning the `createUndoStack` factory pattern (bounded, `ensureBound` trim from oldest) + the `createCellRange` subscribe shape. `push` fills monotonic seq + timestamp; `list()` newest-first; `clear()` (seq never resets — audit integrity); `subscribe` + `getVersion` (for `useSyncExternalStore`); default limit 200.

**b) React `auditLog?: boolean`** — prop after `freshness` (props.ts:519); ref-once controller mirroring `undoStackRef` (:1249); `commitRowList(next, type?)` gains an optional type hint (default `'edit'`) + a module-scope `auditDiff` helper (rowKey-level, first change per commit, one entry per commit — keeps complexity budget flat); full call-site hint map (insert/remove/update/paste/batch/fill/undo/redo); toolbar gate at :5323 admits `auditLog`; trigger `data-iris-audit-trigger` after the chart trigger (:5909); `AuditPanel.tsx` clones `TableChartPanel` (useFloating + portal + Esc/outside/scroll close, token styling, muted partial-context rows, maxHeight + scroll); handle gains `getAuditLog()`/`clearAuditLog()`.

**c) i18n** — `table.audit`/`.empty`/`.clear`: en in core `defaultMessages` (next to `table.undo` :133), zh in `plugin-locale-zh` (:71).

**File map:** 4 new files (core controller + test, AuditPanel + test) + 6 edits (core index/i18n, zh locale, props, types, Table.tsx) + 14 numbered fiats for gate arbitration.
