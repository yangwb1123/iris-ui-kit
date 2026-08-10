All gates pass. The work was left in the worktree by a prior attempt that timed out before gating; I reviewed the full diff against the spec, confirmed each requirement, and ran the complete verification suite.

## Report

**Files changed (4 + tests = 5):**

- `packages/react/src/primitives/table/types.ts` — `IrisTableColumn.groupBy?: boolean` (single line, doc comment: flat-only, tree fail-closed, proxy per-page, first `groupBy` column wins)
- `packages/react/src/primitives/table/props.ts` — `toolbar.batch?: { label; onClick(keys); icon? }` (single line, function-type prop)
- `packages/react/src/primitives/table/Table.tsx` — all 3 features
- `packages/react/src/primitives/table/test/group-batch-autowidth.test.tsx` — new (229 lines ≤ 500)
- `docs/vxe-grid/DECISIONS.md` — pipeline baseline entry (pre-existing; no source)

**Tests added:** 12 (auto-width template + string-width untouched; batch appears with selection / hides when empty / never in single-select / delivers `[...displaySelection]`; group headers with value+count in first-appearance order, rows under headers in original order, per-group `sum` (250/200) + global footer (450), selection keys unchanged on grouped rows, no-groupBy unchanged, tree mode fail-closed, filtering groups before grouping).

**Counts:** 12 new tests; total suite 151 files / 1656 tests pass; typecheck clean; lint **0 errors** (1 pre-existing `IrisTable` complexity warning, unchanged); spec scanner `--mode all` → **0 violations** (1403 files); no dist/tgz/node_modules/manifest.json edits.

**Implementation notes (verified in diff):**

1. **Auto width** — `col.width === 'auto'` → `minmax(max-content, max-content)` branch added _before_ the generic string branch in `gridTemplateColumns`; `resolvedColWidths` already falls back to `DEFAULT_PINNED_WIDTH` (140) for non-numbers (verified at the existing branch).
2. **Batch toolbar** — rendered when `selectable === 'multi' && displaySelection.length > 0 && toolbar.batch`, after built-ins, before custom `buttons`; `data-iris-table-toolbar-batch`, `--iris-primary`/`--iris-primary-foreground` tokens only.
3. **Group rows** — `groupPlan` useMemo over `bodyData` via core `groupRows` (zero core changes); rows keep original `bodyData` index so seq/striped/span/checkMethod/selection are untouched; both body paths covered (plain map + `IrisVirtualScroll`); per-group summary reuses the same `aggregate` ops via extracted `renderSummaryRow` (global footer and group footers share it, discriminated by `data-iris-group-summary`).

**Unfinished / documented limitations:**

- Pinned offsets & column virtualization keep the 140px approximation for `'auto'` (need a number — comment in code).
- Group labels are raw `String(value)` — no formatter hook (spec allowed "just the value").
- Grouping + virtualization uses fixed `itemHeight`; variable-height group headers unsupported (vxe parity caveat, commented).
- Tree mode ignores grouping (fail-closed, tested); proxy mode groups per loaded page.
