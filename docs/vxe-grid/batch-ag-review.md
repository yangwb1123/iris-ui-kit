Verdict written to `docs/vxe-grid/batch-ag-review.md`: **PASS** with 5 non-blocking findings.

## Summary

**Verified (all commands run against commit `7b4cd99d`):**

- Core test 1255/1255, react test 1850/1850 (+21 new), typecheck clean, lint 0 errors (1 pre-existing warning), audit 0 vulns, `check:manifest` up-to-date (155×4, persistState + 3 types), `iris-ui-spec --mode all` 0 violations, prettier clean, file lengths ≤500

**Checklist results:**

1. **persistState** — mount restore purely via change callbacks (every piece gated on callback presence); pageSize exception hooks into the proxy-creation effect _before_ the first query with a single `request({pageSize, page:1})` (verified `request(partial)` merges + fires exactly once in core); save-on-change with JSON dedupe; SSR window guard (renderToString test), corrupt/non-object JSON ignored, private-mode/quota errors swallowed; include filter both directions; `storage: false` zero reads/writes; no-restore-without-callback tested (multiSort + pageSize gates). Skip-first ordering confirmed: proxy effect → restore effect → save effect, mount commit keeps restored values.
2. **Variable height** — cumulative offsets via core Fenwick tree (zero core changes), tests pin `translateY(cum[i])`, deep-scroll window exactness, fixed form unchanged (`i*height` closed form), overscan buffer pass-through, plan-index trap (detail slot interleave) tested.
3. **Additive/manifest** — zero core/other-framework/tokens changes, `itemHeight` only widened, optional prop, barrel exports, no new CSS.

**Findings (all LOW/INFO):**

1. LOW — persisted pageSize bypasses `autoLoad: false` (`Table.tsx:926-929`); documented in adapt report, suggest gating on `autoLoad !== false`
2. LOW — save-side pageSize gate is proxy-presence-only vs restore requiring `onPageChange`; asymmetric mount clobber possible; suggest symmetric gate
3. INFO — StrictMode dev double-run of restore (idempotent, matches pre-existing autoLoad behavior)
4. INFO — weak shape validation on restored filters/columnVisibility objects (arrays pass `typeof === 'object'`)
5. INFO — `lastWrittenRef` not keyed by storage key (contrived edge)
