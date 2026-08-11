Review complete — **Verdict: FAIL** (written to `docs/vxe-grid/batch-p-review.md`).

## Verification run

- React tests **1705/1705** ✅ · typecheck 0 errors ✅ · lint 0 errors (1 pre-existing complexity warning) ✅
- `iris-ui-spec.py --mode all --json` → 0 violations ✅ · `audit-tokens.mjs` → no new warnings ✅
- `pnpm check:manifest` → **exit 1** (restored after check, tree unchanged)
- vxe 4.20.11 parity cross-checked in `/tmp/vxe-ref` (`footer.js`/`table.js`)
- Two throwaway empirical probes (removed after; tree clean)

## Findings

1. **MAJOR (gate-blocking)** — manifest stale: `check:manifest` fails; regen adds exactly the 7 new props (IrisTable react propCount 93→100). Fix: `pnpm gen:manifest` + commit the 2 generated files.
2. **MAJOR** — footer `rowspan` corrupts the stack: `Table.tsx:3015-3017, 3120-3122, 3194-3196` mark later rows' cells occupied (`null`), but each footer row is its own grid container so `gridRowEnd: span N` (`:3042/:3140/:3214`) can never cover them. Probe: `{rowspan:2}` at `[0,0]` → footerData `'Grand'` cell silently disappears, remaining cells shift left under wrong headers. Fix: treat footer rowspan as inert (mirror header rowspan) or single-grid the stack.
3. **MINOR** — `mergeHeaderCells` not fail-closed under `columnVirtualization` (`Table.tsx:3845-3846`), contradicting baseline requirement (a) and the prop's own JSDoc (`props.ts:306-309`); probe confirmed merge active under virtualization. Code and doc must agree.
4. **MINOR** — `aggregateAccuracy` unvalidated: `Table.tsx:3030` `toFixed(n)` throws `RangeError` for `n<0` or `n>100`.
   5-7. **INFO** — footerData in the span stack deviates from baseline literal text but is vxe-aligned and documented (accepted); `padding` string vs vxe boolean; test gaps (footer rowspan, virtualization×merge, footer tooltip empty-content).

Passing: colspan merge + occupy skip + gridColumnEnd, flat-only merge, footer colspan + stack rowIndex + body `spanMethod` untouched, round/padding precedence (prop > size preset > default), accuracy rounding (finite-only, before `renderSummary`, global + per-group), tooltips (config-gated, empty-drops, body untouched), additive-only, core framework-free, all-CSS-var tokens.

No source files modified.
