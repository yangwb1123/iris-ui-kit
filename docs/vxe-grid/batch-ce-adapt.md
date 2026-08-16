Done. Batch CE (复制选中高亮) is complete and committed.

## Report

**Commits**:

- `18bce3ae` — `feat(table): grid 批 CE——复制选中高亮（iris 独有）`
- `f57bff81` — `docs(table): batch CE adapt report`

**Files changed** (2 source + 1 test + 1 report; ≤4 + tests):

- `packages/react/src/primitives/table/Table.tsx` — `writeClipboardText` → `Promise<boolean>` (success iff any of the 3 channels take the copy); `COPY_FLASH_MS = 600`; `copyFlashRange` snapshot state + timer (re-copy restarts, unmount cleanup); both consumption points wired success-gated (window Ctrl/Cmd+C at the keydown handler, `copyActiveRange` for the range toolbar 复制); render adds `data-iris-copy-flash="true"` + `backgroundColor: COPY_FLASH_BG` longhand merged after `fnrCellStyle`/`rangeFillCellStyle`, before `lockedRender.style`. Module-scope helpers (`inCopyFlashRange`/`copyFlashCellAttr`/`copyFlashCellStyle`) keep the row-render arrow at its baseline complexity 70.
- `packages/react/src/primitives/table/styles.ts` — `COPY_FLASH_BG` = `color-mix(in srgb, var(--iris-primary) 25%, var(--iris-background))` (token-only, compare-view precedent).
- `packages/react/src/primitives/table/copy-flash.test.tsx` — **NEW**, 11 tests / 271 lines (≤500).
- `packages/manifest/{manifest.json,llms.txt}` — regenerated twice (pre/post-prettier), **zero diff** (155 components, propCount 168).
- `docs/vxe-grid/batch-ce-adapt.md` — report.

**Tests added** (11): spec's two mandatory blocks explicitly mapped — ① flash appears on success (exact 2×2 rect, attr + token bg, nothing outside) ② removed at 600ms; plus toolbar button, clipboard-reject → no flash (spec's "复制成功后" gate), execCommand-only success, re-copy timer restart, snapshot semantics (doesn't chase selection), `copy:false` regression, no-range no-op, unmount cleanup, `copyFormat` still flashes.

**Counts**: react 2420→**2430** · core 1533 unchanged · spec **0 violations**.

**Verification**: core test ✅ · react typecheck ✅ / test 2430/2430 ✅ · react lint 0 errors (1 pre-existing IrisTable complexity warning) ✅ · `iris-ui-spec.py --mode all --json` 0 violations ✅ · `gen:manifest` regenerated, zero diff, committed ✅.

**What is left**: runner's review/gate stage. Remaining working-tree dirt (`DECISIONS.md`, `batch-cd-gate.md` mods, untracked `batch-ce-baseline.md`) is prior-stage leftovers, untouched. No baseline open questions — the design was fully specified.
