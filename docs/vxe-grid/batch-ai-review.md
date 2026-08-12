## Verdict: **FAIL** — review written to `docs/vxe-grid/batch-ai-review.md`

**Confirmed blocker (medium)** — sort "last-user-action-wins" is documented (baseline, adapt doc, code comment at `Table.tsx:1102-1106`) but not implemented. `querySort` (`Table.tsx:1106-1128`) never consults the internal uncontrolled sort state from `useTableSort` (`sort` at line 1069). **Verified empirically** with a scratch test (deleted after): with `query="sort by name asc"`, clicking the Age header leaves rows sorted by name (Alice first; expected age-asc → Charlie first). The parent-sort-prop and `remoteSort` guards work; only the header-click takeover is missing.

**Parser leniency (low)** — probed 40+ inputs with `node --experimental-strip-types`:

- Finding 2: dangling/doubled conjunctions silently accepted — `role = Test or`, `and role = Test`, `age > 25 and and role = Test` all parse with **no error** (`splitClauses` flush drops empty clauses, `query-parser.ts:102-108,158`).
- Finding 3: `name in (a) in (b)` parses to `['a) in (b']` with no error (`query-parser.ts:271`).

**Everything else passes:**

- core test **1291/1291** (+36), react test **1883/1883** (+6), typecheck ✓, lint 0 errors (1 pre-existing complexity warning), audit 0 vulns, `check:manifest` up to date (query/onQueryChange scoped to react only)
- Parser: all 8 ops, quotes, in-lists, trailing sort, OR-folding/fail-closed, error-strings-never-throw, empty, whitespace, case, unknown-field — all verified
- React: input gating (`query !== undefined`), error hint + last-valid-parse, local merge (substring + inValues + rules), proxy first-request comma-join, additive-only (byte-identical without the prop)
- Hygiene: core framework-free grep empty, only defined `--iris-*` tokens, en+zh i18n (exact zh string), manifest regenerated
- `check:tokens` and `arch-check:ratchet` fail but are **pre-existing** (verified identical failure sets at HEAD~1 via temp worktree, since removed); `iris-ui-spec.py` is harness-side and not present in this repo (couldn't independently verify)

No source files were modified; the only file written is the verdict markdown.
