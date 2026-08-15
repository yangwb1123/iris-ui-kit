Review complete — **PASS**. Verdict written to `/home/u1/iris-ui/docs/vxe-grid/batch-bi-review.md`.

## Summary

**Verifications (all fresh, all green):**

- core test **1474/1474** · react test **2176/2176** (incl. SSR) · react typecheck clean · react lint 0 errors (1 complexity warning at `Table.tsx:1412` — pre-existing, confirmed via prior review chain) · `audit:security` 0 vulns · `check:manifest` up to date (155×4; column field correctly manifest-invisible, propCount unchanged)

**Spec correctness confirmed:**

- Prop anchored exactly (`types.ts` after `exportRaw`, before `filterable`); inclusive per-prefix series via `filteredData` row-identity memo; `getCellValue` choke point (dataIndex/formula tests pass); gate/precedence/title-chain/SVG/token details all match the 7 baseline fiats; flat + virtual body paths share the one branch; `chartDomain` extraction behavior-identical (9 regression tests); vue/solid/svelte untouched; additive-only.

**Findings (0 blockers):**

1. **LOW** — `Table.tsx:538`: series map skips `Number` coercion vs. baseline design + `types.ts` doc claim ("coerce like buildChartData"); mixed numeric-string columns chart gaps instead of points. Fix: coerce or fix the doc.
2. **LOW** — `chart-data.ts:51`: new public `chartDomain` only skips `null`, but its doc promises finite-only; direct `NaN`/`Infinity` input poisons the domain (`[NaN,5]` → `{NaN,NaN}`). No in-tree caller affected; one-line fix (`!Number.isFinite(value)`).
3. **INFO** — `var()` in SVG presentation attributes (browser-inconsistent, but exact repo-wide ChartPanel precedent).
4. **INFO** — duplicate row-object identity collapse (baseline-designed fiat).
