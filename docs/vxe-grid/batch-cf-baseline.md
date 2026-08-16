Baseline complete — written to `/home/u1/iris-ui/docs/vxe-grid/batch-cf-baseline.md` (14 lines, matching the established checked-in summary convention). Zero source files touched; git status shows only the pre-existing prior-stage dirt (`DECISIONS.md`, `batch-ce-gate.md`) plus the new baseline.

## Baseline essence (batch CF：空态动作按钮 — iris 独有)

**Design** — one prop-type widening + one render site, additive fail-closed:

- **Type** (`props.ts:526`): `emptyState?: ReactNode` → `ReactNode | { text?: ReactNode; action?: { label: string; onClick: () => void } }`. ReactNode form byte-identical; object form is the only new path. No new prop → manifest propCount stays 168 (type-string diff only).
- **Render** (`Table.tsx:9477`, the single `data-iris-table-row="empty"` row): module-level helpers (`emptyActionOf`/`emptyTextOf`/`renderEmptyState`) + `EMPTY_ACTION_STYLE` const keep the body-render complexity budget flat. **单行** = inline flow — text span (12px `marginInlineEnd`, error-row retry precedent, RTL-safe) + `<button type="button" data-iris-empty-action>` on the same centered row; shared `STATE_ROW_STYLE` untouched.
- **Button style** mirrors the retry button token-for-token (all `--iris-*` tokens, zero magic values).
- **Discriminator guard**: `typeof object && !Array && !isValidElement` — a React element passed as emptyState stays on the node path.
- `TableBody.tsx:119` parallel render is **unwired dead code** (zero importers, verified) — left byte-identical, its narrower prop type keeps the widening type-safe.
- core / types.ts / i18n / styles.ts / solid·vue·svelte: zero changes (react-only, iris 独有 convention).

**File map**: `props.ts` (:526) · `Table.tsx` (:9477 + helpers + style const) · NEW `test/empty-action.test.tsx` · manifest regenerated.

**Test plan**: 9 cases (react 2430→2439) — spec's two mandatory blocks explicitly mapped (① 渲染 → T1, ② 点击 → T2), plus text default/custom, `action` omitted fail-closed, ReactNode regression (zero wrapper), element-discriminator guard, token style assertions, non-empty no-button.
