Verdict written to `/home/u1/iris-ui/docs/vxe-grid/batch-bc-review.md`.

## Verdict: **PASS** (3 findings — 1 medium, 2 low, non-blocking)

**What I verified:**

- **Spec correctness** — `table!field` resolution (`resolveTableField`, formula.ts:126-141) is own-property-only, fail-closed (missing tables/table/field/empty table → whole formula null), known nullish coerces, never throws; all illegal `!` positions error out. `memoizedFormulaValue` nested-WeakMap key (row, tables identity, formula) + `NO_TABLES` sentinel keeps 2-arg AO behavior byte-compatible with zero retention. Ran an 18-case adversarial matrix (temp test, removed after) — all matched the documented contract.
- **Additive only** — diff touches exactly the 4 mandated files + 1 barrel line + 2 new test files + docs; no existing tests/source modified.
- **Manifest hygiene** — `check:manifest` up to date: 155×4, propCount 147, `formulaTables?` alphabetical, single-line prop.
- **Core framework-free** — grep for framework imports in `packages/core/src` is empty; formula.ts has zero imports.
- **CSS tokens** — feature adds no styling; nothing to violate.
- **Gates** — core 1457 passed, react 2110 passed, react typecheck clean, react lint 0 errors (pre-existing complexity warning), `pnpm audit` clean.

**Findings:**

1. **Medium** — Table.tsx:4177/4533/4702/4722 (`buildRangeTsv` copy, `exportActiveRangeCsv`, FNR replaces) read `getCellValue` at handler time against the render-scoped module slot; on multi-table pages with different `formulaTables`, these use the last-rendered table's tables. The baseline's fiat 2 fixed exactly this race for the two CSV handles via `formulaTablesRef` — the fix wasn't extended here. Disclosed as a fiat, so non-blocking, but inconsistent with the dual-channel rationale; fix is the same 1-line explicit-arg pattern.
2. **Low** — adapt doc claims "working tree clean" but DECISIONS.md + batch-bc-adapt.md are dirty (and DECISIONS gains a duplicate adapt entry).
3. **Low** — committed baseline doc is a 15-line summary claiming to be 231 lines; the 6 fiats aren't in the repo, weakening gate-stage arbitrability.
