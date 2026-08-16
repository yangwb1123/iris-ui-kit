Baseline complete: **`/home/u1/iris-ui/docs/vxe-grid/batch-cw-baseline.md`** (43 lines). Zero source files touched — `git status` shows only the new baseline plus pre-existing prior-stage dirt (`DECISIONS.md` M, `batch-cv-gate.md` ??), HEAD `ace9950c` unchanged.

**Key findings baked in:**

- **Import has one throat**: `handleImportFile` (Table.tsx:4477) — the only place `parseCsv` runs; builds `Record<string, unknown>[]` and **immediately calls `toolbar.onImport?.(rows)`**. CW gates exactly this call — zero new CSV machinery; the rows type already matches `onImport`'s signature (zero types.ts changes).
- **`parseCsv` (core table-export.ts:200)** is RFC-4180 (quoted fields/embedded commas/newlines), values always strings; `<2` parsed lines is a silent no-op that must be preserved.
- **Toolbar ⇪ button** (:9297-9330, `data-iris-table-toolbar-import`) + hidden file input — the panel mounts in the same toolbar fragment (batch-edit-panel render-site precedent).
- **Esc-overlay precedent**: zoom's window-keydown effect only while open (:4442-4450); **backdrop token exists**: Dialog uses `var(--iris-backdrop, rgba(0,0,0,0.5))` — token-driven, no hardcoded color.
- **i18n split**: en defaults in core `i18n.ts`, zh in `plugin-locale-zh/src/core/index.ts`; `table.total` already exists for the >5-row count note (chart panel reuse precedent).

**Design** — `importPreview?: boolean` top-level (props.ts after `zoomConfig`, propCount 182→183 / eventCount 32 unchanged): parse/row-build unchanged, gate splits at the call — `importPreview ? setImportPreviewRows(rows) : toolbar.onImport(rows)`. Fixed centered modal (zoom + Dialog precedents): title, first-5-rows table, `table.total` note when >5, 取消/确认 footer; confirm calls `onImport` with **ALL** rows, cancel/Esc/backdrop close with zero calls; off → byte-identical. +3 i18n keys en+zh. 9 explicit fiats cover modal-vs-anchored, full-payload, header-only CSV, silent-no-op preservation, raw-string cells, no-partial-commit, fresh-state-per-selection, zero toolbar-gate change, total-note reuse.

**File map** — props.ts +1 · Table.tsx 5 touch points (destructure/state/gate split/confirm-cancel/Esc effect/overlay render + module helper) · core i18n +3 · locale-zh +3 · NEW `import-preview.test.tsx` · comparison doc 2 spots · manifest regen.

**Test plan** — react +13 (2636→2649): spec-mandated ① preview shows exactly 5 of 7 rows ② confirm calls `onImport` once with all 7 ③ cancel calls nothing; plus fail-closed byte regression, Esc/backdrop close, header-only→`onImport([])`, no-header no-op, total note boundary, truncation, re-import freshness, quoted fields, zh locale.
