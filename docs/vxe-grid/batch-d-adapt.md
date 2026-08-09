All gates green. Implementation complete.

## Report

### Files changed (10 source/test files + 2 docs)

**Core-side (4 files + 1 test; framework-free invariant holds — `grep "from '(react|vue|solid|svelte)'" packages/core/src` → 0):**

- `packages/core/src/table-form.ts` — **NEW** (72 lines): pure materials `seedFormValues` / `buildFormValues` / `mergeFormFilters` (default seeding, empty-string stripping, form-over-base merge with no input mutation)
- `packages/core/src/table-form.test.ts` — **NEW** (83 lines, 13 tests)
- `packages/core/src/i18n.ts` — +2 keys (`table.formSubmit: 'Search'`, `table.formReset: 'Reset'`)
- `packages/core/src/index.ts` — barrel exports the 3 materials
- `packages/plugin-locale-zh/src/core/index.ts` — +2 keys (`查询`/`重置`; the package's "translates EVERY built-in key" guard auto-covers them)

**React-side (4 files + 1 test):**

- `packages/react/src/primitives/table/types.ts` — `IrisTableFormField` (key/label/type/options/placeholder/defaultValue)
- `packages/react/src/primitives/table/props.ts` — `IrisTableFormConfig` + additive `formConfig?`; `toolbar.buttons?: Array<{key,label,onClick,icon?}>` inside the existing toolbar (fields intact); all new function types single-line (manifest-scanner safe — verified: exactly +1 prop, zero new noise)
- `packages/react/src/primitives/table/Table.tsx` — draft/applied two-state (keystrokes never query; re-seed keyed on field signature so inline `formConfig` identity churn never wipes input); submit → `onSearch` + proxy `setParams({filters: merged, page: 1})` or local merge into the existing `filteredData` memo (prop never mutated); reset → defaults + `setParams` + forced `refetch()` (dedupe no-op guard); form above toolbar with `IrisFormField`+`IrisInput`/`IrisSelect`+`IrisButton`, i18n labels; custom buttons after built-ins with `data-iris-table-toolbar-button-{key}`; print CSS hides form; all styles `--iris-*` tokens
- `packages/react/src/primitives/table/index.ts` — exports both new types
- `packages/react/src/primitives/table/test/form-config.test.tsx` — **NEW** (277 lines, 7 tests)

**Docs:** `docs/vxe-grid/batch-d-adapt.md` (implementation report, mirroring batch C's pattern)

### Test counts

- **Core: 1230/1230 passed (80 files)** — 13 new
- **React: 1535/1535 passed (142 files)** — 7 new (form render/order/labels/defaultValue seeding, onSearch with stripped values + select draft, remote query with merged filters + page reset, local client-side filtering + prop non-mutation, reset clears + re-queries, toolbar buttons order/click, proxyConfig+formConfig+edit write-back coexistence)
- React typecheck clean; lint **0 errors** (1 pre-existing `IrisTable` complexity warning — explicitly acceptable)
- `iris-ui-spec.py --mode all --json`: **0 violations**
- `@iris-ui-kit/plugin-locale-zh`: 6/6; prettier clean; all test files ≤500 lines

### Deviations from the baseline design

1. **`IrisTableFormField<Row>` generic dropped** → plain interface: repo's `noUnusedLocals` makes an unused type param a TS6133 error, and a search-only field has no legitimate `Row` use. Semantics unchanged.
2. **Remote submit merges form values over the `filters` prop** (`mergeFormFilters`) — satisfies the "merged filters" test spec and composes with batch C's `remoteFilter` prop-sync.
3. **Reset re-applies `defaultValue`s** (vxe `resetValue` semantics) rather than always-empty; with no defaults this is exactly "re-query with empty values". `refetch()` is forced after `setParams`; when filters did change this yields a second token-guarded request (harmless, latest wins).
4. **Proxy-mode local filtering**: `filteredData` keeps batch C behavior (prop filters still filter the loaded page when `remoteFilter` is off); form values stay out of the local path in proxy mode (server owns form filtering), per the spec's "if no proxyConfig → client-side" scoping.
5. **Core `dist/` regenerated via build** (not hand-edited) so react typecheck sees the new exports; `packages/manifest/*.json` untouched — run `pnpm gen:manifest` in the pipeline to pick up `formConfig`/`toolbar.buttons` and the core exports.
