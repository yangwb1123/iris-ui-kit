Review complete. **Verdict: FAIL** — written to `docs/vxe-grid/batch-o-review.md`.

## Summary

**Verification run:** react typecheck ✅ · react tests 1687/1687 (14 new) ✅ · core 1249 ✅ · plugin-locale-zh 6 ✅ (zh guard) · lint 0 errors (1 pre-existing complexity warning) · `iris-ui-spec.py` 0 violations (tokens-only CSS) · `check:tokens` warnings pre-existing, none from batch O.

**Feature checks — all pass:** TSV copy row/col order + formula neutralization (exact-string tests) · clipboard guard safe without API (optional chaining + try/catch + execCommand fallback) · paste through one batched `commitRowList` (setLiveData + externalDataRef + onDataChange), rowKey-mapped so sort/filter/proxy-safe · overflow ignored past last row/col · fnr Ctrl+F gated on `data-iris-table-editor` (all 3 editor kinds carry it) · highlight + guarded scrollIntoView · next/prev wrap · replace single/batch + replace-all single commit · Esc closes+clears · bar is a sibling of form/toolbar/root so sort/filter/edit untouched · inert without props · core framework-free (5 i18n keys only) · all CSS `var(--iris-*)`.

**Findings:**

1. **MAJOR (gate-blocking)** — `props.ts:306-310` added `clipConfig`/`fnr` but `packages/manifest/manifest.json`/`llms.txt` were not regenerated; `pnpm check:manifest` exits 1 (regenerated diff = exactly the 2 new props, propCount 91→93). Manifest is a pre-merge gate per AGENTS.md. Fix: `pnpm gen:manifest` + commit the 2 generated files.
2. **MINOR** — `Table.tsx:2139` window-scope copy/paste only exempts INPUT/TEXTAREA; Ctrl+C/V on any non-input element _outside_ the table with a live range is hijacked. Fix: `rootRef.current?.contains(target)` guard.
3. **MINOR** — `Table.tsx:2143` tagName guard misses `<select>` editors (fnr handler uses the dataset guard — inconsistent). Fix: same `dataset.irisTableEditor` check.
4. **MINOR** — `Table.tsx:3240` bar-level Enter handler `preventDefault`s for any target: Enter in the **replace** input steps instead of replacing, and Enter on focused bar **buttons** is swallowed. Fix: scope to the find input.
   5-8. **INFO** — Esc in a cell editor also closes the bar; no no-Clipboard-API test coverage; Ctrl+F in the toolbar search form opens the bar; replace leaves active index stale until recompute.

No source files modified (I restored the manifest files my `check:manifest` run regenerated).
