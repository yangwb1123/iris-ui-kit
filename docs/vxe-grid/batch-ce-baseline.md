Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-ce-baseline.md` (18 lines, matching the established checked-in summary convention). Zero source files touched — the `M DECISIONS.md` / `M batch-cd-gate.md` entries are prior-stage docs, already dirty before this session.

## Baseline essence (batch CE：复制选中高亮 — clipConfig 复制反馈, iris 独有)

**Design** — zero new props (additive fail-closed: gated entirely by existing `clipConfig`, copy path):

- **Success detection** (spec's "复制成功后"): `writeClipboardText` `Promise<void>` → `Promise<boolean>` (Table.tsx:1550) — true iff any of the 3 channels succeed (core `copyText` handler / `navigator.clipboard.writeText` resolve / `execCommand('copy')` boolean). All 3 call sites are `void`-prefixed → signature widening is call-site-compatible.
- **Two trigger points** = both range-copy consumption points: window Ctrl/Cmd+C (:5976-5982) and the range toolbar 复制 button (`copyActiveRange` :6178-6182) — `buildRangeCopy(...)` then `.then(ok => ok && flashCopyFeedback(range))`.
- **State**: `copyFlashRange` snapshot (normalized rect at copy time — doesn't chase selection changes) + 600ms timer (`COPY_FLASH_MS`), re-copy restarts the clock, unmount cleanup.
- **Render**: `data-iris-copy-flash="true"` + `backgroundColor` longhand (batch BE discipline — never clobbers background-image; locked stripes coexist), merged after `fnrCellStyle`/`rangeFillCellStyle`, before `lockedRender.style`.
- **Token color**: `color-mix(in srgb, var(--iris-primary) 25%, var(--iris-background))` — color-mix + var() precedent (styles.ts:207-211), distinct from the persistent selection tint.

**File map** — Table.tsx (signature + state/timer + 2 wirings + body-cell attr/style) + styles.ts (+`COPY_FLASH_BG`) + NEW `test/copy-flash.test.tsx`. Zero changes to props/types/core/i18n; manifest stays 168/155 (zero diff).

**Test plan** — 10 cases, spec's two mandatory blocks explicitly mapped (① flash appears on success → T1, ② removed at 600ms → T2), plus failure-path no-flash, re-copy timer restart, snapshot semantics, `copy:false` regression. react 2419→2429.
