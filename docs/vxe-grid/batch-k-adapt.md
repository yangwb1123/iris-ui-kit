Batch K complete. All verification gates pass.

## Report

**Files changed (3 modified + 1 new test, ≤5):**

- `packages/react/src/primitives/table/props.ts` (+2) — `IrisTableEditConfig.mode?: 'cell' | 'row'` (single line, default `'cell'` → zero behavior change)
- `packages/react/src/primitives/table/Table.tsx` (+551/−200) — M1, M2, row edit mode
- `docs/vxe-grid/DECISIONS.md` (+4) — baseline stage log (pre-existing from baseline)
- **New** `packages/react/src/primitives/table/test/row-edit-mode.test.tsx` (356 lines, 8 tests)

**M2 fix (lazy-tree cache invalidation):** in the existing liveData sync effect (where `lastExternalRef` moves), a new data-source reference now clears **both** `lazyChildrenRef` and the in-flight `setLazyLoading` set. Internal write-backs never reach the effect, so the cache survives edits/row ops. Tests: cached children dropped + fresh `getSubRows` children render; refreshed lazy row becomes a lazy leaf again and re-fetches on expand.

**M1 fix (pending Tab navigation):** `pendingNavRef` stashed on Tab when `editRules` present (async validate path); the settle-observer effect (subscribed to the cell-edit store) navigates only when the commit lands (`editing === null` + `validated` set), drops the intent on validation failure (error stays visible, keys off core's async-settle semantics: reject keeps `editing` set with error, success clears it + sets `validated`), and drops on cancel. Sync commits still navigate immediately in the Tab handler (snappy common case). Tests: async resolve → moves to next column; async reject → stays with error, no commit.

**Row edit mode:** clicking any cell of a row with ≥1 editable column opens one `CellEdit` session per editable column (same `beginEdit` machinery per column); `data-iris-row-editing="true"` + `--iris-surface-selected` highlight on the row; shared `EditorSurface` parameterized by session (text/number/select/textarea branches preserved). Enter/blur commit **that** column (per-cell commit, documented); Escape cancels the whole row; clicking another row commits the current row's open editors first (sync failure blocks the switch, error visible); toolbar/sort/filter untouched. Fixed during this session: last-session-close now derived from state (`rowSessions` empty → clear `rowEditing`) instead of a ref read that missed batched double-Enter commits.

**Counts:** typecheck ✓ · tests **1626/1626** (149 files, incl. 8 new) ✓ · lint **0 errors** (1 pre-existing `IrisTable` complexity warning) ✓ · spec scanner **0 violations** ✓. Core framework-free: `packages/core` untouched. No dist/tgz/node_modules/manifest.json edits; CSS tokens only `--iris-*`.

**Unfinished:** none — the full K scope (both fixes + row mode + tests) is implemented and gated.
