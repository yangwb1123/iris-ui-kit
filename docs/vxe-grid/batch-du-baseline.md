Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-du-baseline.md` (97 lines, the only change; `docs/GRID-PLUGIN-REFACTOR.md` is a pre-existing unrelated untracked file — untouched. Zero source modifications.)

## What was verified (all anchors against HEAD `4bc9be0b`)

- **DU not yet implemented** — `rg exportAnnotations` → zero hits across the monorepo; this is a forward design for the adapt stage, unlike DT/DS whose baselines were post-commit confirmations.
- **Annotation machinery**: `annotations?: Record<string, string>` (props/query.ts:148, `::` cell-key contract :143), `cellNote` dynamic callback (:150), resolved via `cellNoteState` (cell-helpers.tsx:81, already imported at Table.tsx:97), render call at Table.tsx:6177-6182 with k = `rowKeyOf(row, i)` (:1677/:3177-3183).
- **Export-family precedents**: `exportSelectionCsv`/`exportRowsCsv` bodyData + `''`-when-empty shape (:3453-3472), `exportTimelineCsv` as the archetype — boolean feature-prop gate (`auditEnabledRef` :816-818) + spec-literal columns via core `toCsv` (:3667-3697), mount-time ref mirrors (`bodyDataRef` :4033, `rowKeyRef` :4044).

## Key design decisions (documented in baseline)

- `exportAnnotations?: boolean` = batched boolean feature gate (auditLog precedent, default off); `exportAnnotationsCsv(): string` = per-annotated-cell CSV `rowKey,column,annotation`, notes resolved by the **same** `cellNoteState` path as the render (dynamic `cellNote` wins; hidden columns excluded via `viewColumnsRef`; row order = bodyData).
- Spec-literal empty semantics: prop off → `''` (fail-closed family), on-but-no-notes → `''` per the spec test ("无批注返回空") — deliberately diverges from exportTimelineCsv's header-only.
- React-only additive: literal column titles (zero new i18n), no core changes, `toCsv` already imported — but propCount 162→163 forces `gen:manifest`/`check:manifest` (hard gate).

## File map + test plan

props/query.ts +1 prop · types/handle.ts +1 method · Table.tsx 4 points (~20 lines, zero new imports) · new `test/batch-du.test.tsx` — content test with exact byte assertions (`rowKey,column,annotation\n1,name,高亮\n2,city,"注意,含逗号"`), no-annotations → `''`, plus fail-closed guards (prop off, dynamic cellNote, OWASP `=SUM` prefix) and the regression slate. 4 non-blocking observations (off/empty indistinguishable, dynamic-note scope, literal headers, cross-page proxy semantics).
