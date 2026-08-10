Verdict written to `docs/vxe-grid/batch-j-review.md` (the only file created; no source files modified).

## Summary

**PASS** — all gates green (1618/1618 tests, typecheck 0, lint 0 errors with the 1 complexity warning confirmed pre-existing; core untouched and framework-free; diff strictly additive; manifest unaffected; token-driven CSS). All headline spec scenarios verified: caret-on-childless-only, loading guard, loaded-children expand + sort, collapse/expand after load, `removeRows` batch semantics with single `onDataChange` and selection prune (the `displaySelectionRef` fix also repairs a real pre-existing stale-closure bug in `removeRow`), Tab commit→navigate with non-editable skipping, Shift+Tab, no-neighbor commit+close, Enter/Escape preserved.

**Findings (5, verified by scratch probes, now removed):**

1. **[Medium]** Tab is swallowed when the committed column uses async validation (`editRules`) — `commitEdit()` returns false for Promises (core `cell-edit.ts:131-136`), so `moveEditOnTab` preventDefaults, the commit lands later, and the editor closes with focus lost and **no navigation**. Baseline raised it as Q1; adapt claims "Unfinished items: none" without documenting.
2. **[Medium-low]** `lazyChildrenRef` is never invalidated on data refresh — a new dataset with the same key renders the **cached** children and shadows fresh `getSubRows` children (probed: old child id 2 shown, fresh id 7 hidden). Baseline asked to document; nothing does.
3. **[Low]** Stale draft after Tab→Shift+Tab round-trip — `editCtxRef.row` is pre-commit, so the reopened editor shows the old value (no data loss, misleading UI).
4. **[Low]** `onSelectionChange` fires per removed key instead of one batched set (deviation from the baseline's proposed single `selModel.set()`).
5. **[Info]** Loading caret keeps the "Expand" aria-label; the proposed `treeSelect.loading` i18n key was dropped.
