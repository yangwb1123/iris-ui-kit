All verification green. Final report:

## Batch BW complete — committed `f1252651`

**`feat(table): grid 批 BW——右键快捷操作（iris 独有）`** — contextMenu 内置快捷项：复制值 + 清空。

### Files changed (4 source + tests + docs, 12 files)

| File                                            | Change                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/i18n.ts`                     | +2 en keys: `table.copyValue` "Copy value" · `table.clearCell` "Clear cell"                                                                                                                                                                                                                                       |
| `packages/plugin-locale-zh/src/core/index.ts`   | +2 zh keys: `复制值` · `清空` (drift test auto-covers)                                                                                                                                                                                                                                                            |
| `packages/react/src/primitives/table/Table.tsx` | 6 touches: 2 reserved-key consts (`__iris-copy-value`/`__iris-clear-cell`) · module helper `contextCellText` (mask→formatter→String, same chain as `cellTooltip`) · 2 callbacks `copyContextValue`/`clearContextCell` · append point in `handleContextMenu` (after 摘要, before 批注) · onSelect wiring intercept |
| `packages/react/src/primitives/table/props.ts`  | `contextMenu` doc paragraph for the built-in quick actions                                                                                                                                                                                                                                                        |
| `test/context-quick-actions.test.tsx` (new)     | **12 tests, 288 lines** (≤500)                                                                                                                                                                                                                                                                                    |
| 4 existing table test files                     | 12 exact-menu-shape assertions updated for the unconditional items                                                                                                                                                                                                                                                |
| `docs/vxe-grid-comparison.md`                   | 3 places: new 独有表行 · 构建状态 · 测试计数 2332→2344                                                                                                                                                                                                                                                            |
| `docs/vxe-grid/batch-bw-adapt.md` (new)         | adapt report                                                                                                                                                                                                                                                                                                      |
| `packages/manifest/manifest.json`               | regenerated — no structural diff (propCount **162** / eventCount **30** unchanged; only the extracted `contextMenu` description lines)                                                                                                                                                                            |

### Implementation highlights

- **复制值** (`__iris-copy-value`): copies the cell's display text (mask → formatter → `String`, null → `''`) via the existing `writeClipboardText` three-channel safe writer — **no clipboard → safe no-op**.
- **清空** (`__iris-clear-cell`): `setCellValue(...,'')` → `commitRowList` — the **Delete-shortcut precedent verbatim** (same undo/audit/onDataChange funnel); locked/readonly no-op; **no `onDataChange` → internal live data still updates, no crash**.
- **Unconditional** (no new prop): user items → 分布? → 摘要? → **复制值 → 清空** → 批注? (排在批注项前); keys intercepted at wiring (user callback never sees them) + reserved-key dedupe guard.
- CSS: zero new `var(--iris-*)` usage; zero hardcoded hex.

### Verification (all ✅)

- core test **1517/1517** · react typecheck **clean** · react test **2344/2344** (+12) · react lint **0 errors** (1 pre-existing complexity warning)
- `iris-ui-spec.py --mode all` → **0 violations** (1415 files) · prettier clean · `gen:manifest` regenerated + committed
- Constraints held: core framework-free (zero core logic changes — i18n keys only), react-only, additive, ≤4 source files, test file ≤500 lines.

### What is left

- Runner's pending **review/gate** stage (uncommitted `DECISIONS.md` / `batch-bw-baseline.md` are runner-managed, per the established pattern).
- vue/solid/svelte alignment deferred — react-only scope by design (pure react-side menu extension, zero core logic).
