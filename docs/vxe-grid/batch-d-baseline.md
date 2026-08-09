Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-d-baseline.md` (15.6 KB, the only change; no source files touched).

## Key findings baked into the baseline

**vxe-grid formConfig semantics** (from the two type files):

- `FormConfig extends VxeFormProps { enabled?, items: VxeFormItemProps[] }`; grid owns `formData`, rendered above table body / below toolbar. Items: `field` (query key), `title` (label), `itemRender` (`name: 'input'|'select'`, `options`, `changeToSubmit`, `defaultValue`), `resetValue`.
- `proxyConfig.form: boolean` passes form values as a **dedicated `form` param** — sibling to `filters` — in `ProxyAjaxQueryParams`. `form-submit`/`form-reset`/`form-submit-invalid` events; `getFormData()`/`resetForm()` methods.
- Toolbar: `buttons: ButtonConfig[]` (`{code, name, icon}`, click → `toolbarButtonClick`), left cluster.

**Adaptation decisions** (deviations flagged explicitly):

- **Merge form values into `filters`** instead of a new `form` param — keeps `IrisTableProxyQueryParams` unchanged; page-1-on-submit comes for free from batch-C core `applyParams` (filters value change → page 1, `''`-stripping via `normalizeFilters` already there). Zero core changes.
- Local mode routes through a single `effectiveFilters` merge point feeding the existing `filteredData` client-side path; reset forces `refetch()` since dedupe would otherwise no-op.
- `toolbar.buttons` appended **after** built-ins (right cluster) — additive, no toolbar restructure.
- i18n: new `table.formSubmit`/`table.formReset` keys in `core/src/i18n.ts` + `plugin-locale-zh` (en: Search/Reset, zh: 查询/重置).

**File map**: `props.ts` (+types), `Table.tsx` (+form render between toolbar ~line 1464 and grid body, draft/applied two-state so keystrokes never trigger queries, merge + sync-effect wiring, custom buttons), new `test/form-config.test.tsx` (~8 cases), 2 i18n files. 4 open questions (onFiltersChange interplay, changeToSubmit, proxyConfig.form flag, auto-refetch-on-reset confirmation).
