Batch CF（空态动作按钮，iris 独有）complete and committed.

## Report

**Commits**:

- `92455ece` — `feat(table): grid 批 CF——空态动作按钮（iris 独有）`
- `53eace91` — `docs(table): batch CF adapt report`

**Files changed** (3 source + 1 test + 1 report; ≤4 + tests):

- `packages/react/src/primitives/table/props.ts` — `emptyState?: ReactNode` widened to `ReactNode | IrisTableEmptyState`; new **named exported interface** `IrisTableEmptyState` (`text?: ReactNode`, `action?: { label: string; onClick: () => void }`). ReactNode form byte-identical; no new prop → propCount stays 168 (type-string diff only).
- `packages/react/src/primitives/table/Table.tsx` — module-level `isEmptyStateObject` (guard: `typeof object && !Array && !isValidElement`) + `emptyTextOf`/`emptyActionOf`/`renderEmptyState` + `EMPTY_ACTION_STYLE` const (token-for-token mirror of the error-row retry button, all `--iris-*` tokens). The single `data-iris-table-row="empty"` row renders 单行 inline flow: text span (12px `marginInlineEnd` only when an action follows, RTL-safe) + `<button type="button" data-iris-empty-action>`. Component complexity 285→284 (flat budget).
- `packages/react/src/primitives/table/index.ts` — re-exports `type IrisTableEmptyState` (manifest hygiene: export new types).
- `packages/react/src/primitives/table/test/empty-action.test.tsx` — **NEW**, 9 tests / 161 lines (≤500).
- `packages/manifest/{manifest.json,llms.txt}` — regenerated & committed (emptyState type string + `IrisTableEmptyState` in types list; 155 components; pre-existing warnings' first-line JSDoc convention unchanged).

**Tests added** (9): spec blocks mapped directly — ① 渲染 (text + button on same row), ② 点击 (click fires onClick once); plus text default/custom, `action` omitted fail-closed, ReactNode regression (zero wrapper), array/element discriminator guard, token style + `margin-inline-end` assertions, non-empty no-button.

**Counts**: react 2430→**2439** (matches baseline prediction exactly) · core 1533 unchanged · manifest 69 · spec **0 violations**.

**Verification**: core test ✅ · react typecheck ✅ / test 2439/2439 ✅ (re-run post-prettier on committed state) · react lint 0 errors (1 pre-existing IrisTable complexity warning, not a regression) ✅ · `iris-ui-spec.py --mode all --json` 0 violations ✅ · `gen:manifest` regenerated + committed ✅.

**What is left**: runner's review/gate stage. Working-tree dirt (`DECISIONS.md`, `batch-ce-gate.md`) is prior-stage leftovers, untouched. `TableBody.tsx:119` parallel empty render stays unwired dead code (zero importers) — its narrower prop type keeps the widening type-safe. No baseline open questions — design fully specified.
