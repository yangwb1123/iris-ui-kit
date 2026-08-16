Done. Batch CF (空态动作按钮) is complete and committed.

## Report

**Commits**:

- `(this commit)` — `feat(table): grid 批 CF——空态动作按钮（iris 独有）`
- `(this commit)` — `docs(table): batch CF adapt report`

**Files changed** (3 source + 1 test + 1 report; ≤4 + tests):

- `packages/react/src/primitives/table/props.ts` — `emptyState?: ReactNode` widened to `ReactNode | IrisTableEmptyState`; new named exported interface `IrisTableEmptyState` (`text?: ReactNode`, `action?: { label: string; onClick: () => void }`). ReactNode form byte-identical; object form is the only new path. No new prop → manifest propCount stays 168 (type-string diff only). Object form (a non-element plain object) cannot collide with ReactNode (elements/strings/numbers/arrays are structurally distinct).
- `packages/react/src/primitives/table/Table.tsx` — module-level helpers (`isEmptyStateObject` discriminator guard / `emptyTextOf` / `emptyActionOf` / `renderEmptyState`) + `EMPTY_ACTION_STYLE` const (token-for-token mirror of the error-row retry button — all `--iris-*` tokens, zero magic values) keep the body-render complexity flat (285→284). The single `data-iris-table-row="empty"` row now calls `renderEmptyState(emptyState, t('table.empty'))`; descriptor path renders 单行 inline flow — text span (12px `marginInlineEnd` only when an action follows, RTL-safe `margin-inline-end`) + `<button type="button" data-iris-empty-action>`. Discriminator guard: `typeof object && !Array && !isValidElement` — React elements/arrays/strings stay on the untouched node path (zero wrapper).
- `packages/react/src/primitives/table/index.ts` — re-exports `type IrisTableEmptyState` (manifest hygiene: export new types).
- `packages/react/src/primitives/table/test/empty-action.test.tsx` — **NEW**, 9 tests / 161 lines (≤500).
- `packages/manifest/{manifest.json,llms.txt}` — regenerated: `emptyState` type string `ReactNode → ReactNode | IrisTableEmptyState` (+ `IrisTableEmptyState` in IrisTable's types list), 155 components, propCount unchanged.
- `docs/vxe-grid/batch-cf-adapt.md` — report.

**Tests added** (9): spec's two mandatory blocks explicitly mapped — ① 渲染: descriptor renders text + `data-iris-empty-action` button on the same centered empty row (single-line inline flow), ② 点击: `fireEvent.click` fires `onClick` exactly once; plus text default (localized `table.empty`) / custom text wins, `action` omitted fail-closed (text renders, no button), ReactNode element regression (zero wrapper — element is the row's only child, no default text), element-discriminator guard (array of elements stays on the node path — guard excludes arrays), token style assertions (`--iris-border`/`--iris-surface`/`--iris-foreground`/`--iris-radius-sm`/`--iris-space-sm` + `margin-inline-end` gap), non-empty no-button (data present → no empty row, no action).

**Counts**: react 2430→**2439** · core 1533 unchanged · spec **0 violations** · manifest test 69 passed.

**Verification**: core test ✅ (1533) · react typecheck ✅ · react test 2439/2439 ✅ · react lint 0 errors (1 pre-existing IrisTable complexity warning, 285→284, not a regression) ✅ · `iris-ui-spec.py --mode all --json` 0 violations ✅ · `gen:manifest` regenerated, committed ✅.

**What is left**: runner's review/gate stage. Remaining working-tree dirt (`DECISIONS.md`, `batch-ce-gate.md` mods, untracked `batch-cf-baseline.md`) is prior-stage leftovers — the baseline doc is included in this commit per the checked-in summary convention. `TableBody.tsx:119` parallel empty render stays unwired dead code (zero importers, verified) with its narrower prop type keeping the widening type-safe. No baseline open questions — the design was fully specified.
