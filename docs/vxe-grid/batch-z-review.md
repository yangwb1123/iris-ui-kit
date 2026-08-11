Review complete. Verdict written to `docs/vxe-grid/batch-z-review.md`.

## Verdict: **PASS**

All requested gates verified green:

- **typecheck / test / lint (vue)**: ✓ 1531/1531 tests (21 new), 0 lint errors — plus `build` and `prettier --check` on the 5 changed files
- **audit**: ✓ no known vulnerabilities
- **check:manifest**: ✓ up to date, 155 components, 4×155 aligned
- **core framework-free**: ✓ 0 framework imports in `packages/core/src`; commit is additive (vue + manifest + docs only)

Checklist results (each inspected against React reference + diff against `HEAD~1`):

1. **Row mode** ✓ — all editable columns open on any-cell click, per-column Enter/blur commit, Escape cancels whole row, click-elsewhere commits first, sync-validation-failure blocks switch, async-then-cancel drops commit; cell mode diff-verified byte-identical.
2. **contextMenu** ✓ — cursor virtual-anchor positioning (`translate3d(120px, 80px)` tested), Esc/outside/scroll close paths, disabled items inert, header/seq/selection/summary excluded, Teleport to body.
3. **Filter panel** ✓ — trigger `stopPropagation` (aria-sort stays `none`), OR-match channel AND-ed with text channel, remote comma-join via `mergeFilterValues` (React-identical), i18n keys confirmed in core `defaultMessages`, trigger in flat + grouped leaf headers.
4. **Lazy tree** ✓ — caret gating, loading guard, inject+expand, epoch-guarded cache drop with stale-callback rejection (React M2 parity), all 6 tests pass.
5. **Core/additive/manifest/tokens** ✓ — all styles `var(--iris-*)`.

Findings:

1. **Low** — `Table.ts:279`: initial proxy params gate comma-join on `remoteSort` instead of `remoteFilter` (React uses `remoteFilter` and also merges the text `filters`). Masked in practice by the immediate `remoteFilter` watch, but wrong for `remoteSort: true, remoteFilter: false`; fix included.
2. **Low** — row-mode editors lack React's Tab navigation (`moveRowEditOnTab`/async intent); pre-existing gap pattern (vue cell mode never had it), non-blocking.
   3–5. **Observations** — pre-existing React-parity gaps (local-mode write-back, `onTreeExpandChange`, `filterMethod`), none introduced by batch Z.

No files were modified by the review (the uncommitted `DECISIONS.md`/`batch-z-adapt.md` diffs are harness bookkeeping that pre-existed).
