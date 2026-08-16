Baseline complete: **`/home/u1/iris-ui/docs/vxe-grid/batch-cx-baseline.md`** (158 lines). Zero source files touched — `git status` shows only the new baseline plus pre-existing prior-stage dirt (`DECISIONS.md` M, `batch-cw-gate.md` ??), HEAD `e1bd7b2d` unchanged.

**Key findings baked in:**

- **The per-cell numeric-align fallback already exists for body (`:8226`) and footer (`:9042`), but NOT the header (`:10565`, `headerAlign ?? col.align ?? 'left'`)** — today a numeric column renders body/footer right with a left header. The column-level inference fixes exactly this gap.
- **`sortType` wiring already exists** (`useTableSort.buildSorter` honors it; `compareValues` compares typed numbers numerically under `'auto'`) — so detection only changes behavior for heterogeneous rows and pins the type; `leafColumns` feeds `useTableSort`, so inferred `sortType` lands for free.
- **Column chain**: `safeColumns → presetColumns (:2806) → orderedColumns → displayColumns → leafColumns` — the detection layer slots between preset and order (defined-fields-only, preset columns survive).
- **Data-arrival funnel**: the data-sync effect `:3065` → `setLiveData`; the freshness stamp `:3094` is the one-shot-effect precedent.
- **Value path**: `row[col.dataIndex ?? col.key]`, formula columns skipped (their sortType is a contract on the computed value).

**Design** — `autoDetectTypes?: boolean` (props.ts after `footerAlign`, propCount 183→184 / events 32 unchanged, default false byte-identical): one-shot effect on first non-empty `liveData` → new core pure `detectColumnType(values)` (first 50 non-nullish samples, all-samples-agree; number/boolean typed, date = `Date` instance or ISO regex, numeric/boolean strings stay string, mixed → string fail-safe) → `detectedColumns` memo fills `align`+`sortType` only where `undefined` (number → right + `'number'`; string/date/boolean → left + `'string'`). 12 explicit fiats cover header-gap fix, one-shot, first-page-only proxy inference, preset interplay, SSR post-hydration, `sortBy` orthogonality, types.ts zero-change, zero i18n.

**File map** — NEW core `column-type.ts` (+test) + index +2 · props.ts +1 · Table.tsx 5 touch points · NEW `test/auto-detect-types.test.tsx` · comparison doc +1 · manifest regen. Zero changes: types.ts, i18n, vue/solid/svelte.

**Test plan** — core +10 (1559→1569): per-type inference + mixed/numeric-string/boolean-string/non-finite/sample-cap edges. React +12 (2648→2660): spec-mandated ① header right-align ② heterogeneous-row numeric sort ③ type inference ×3, plus off-byte-identical, explicit-fields-win, preset interplay, one-shot, async arrival, grouped leaves, formula skip, mixed fail-safe.
