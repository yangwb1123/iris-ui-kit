Review complete — verdict **PASS** written to `docs/vxe-grid/batch-cl-review.md`.

## Summary

**Implementation verified spec-correct, additive-only, framework-free:**

- `expandAnimation?: boolean` after `lazyLoad` (`props.ts:453`) → manifest 171→172, events 31 unchanged; `check:manifest` up to date
- Keyframes max-height `0 → var(--iris-table-expand-max, 512px)` + opacity, overflow hidden at both endpoints, `--iris-duration-md` (exact match of the 4-framework motion precedent), reduced-motion off — all in the live `iris-table-row-styles` singleton
- Two injection points (detail wrap `:7892`, tree row with depth>0 gate `:7196`) sharing `expandAnimOn = expandAnimation === true && !virtualScroll`; fail-closed attr; virtual fiat consistent with the component's own virtual gating (`:9863`)
- Commit touches exactly 3 react source files; zero core/i18n/types/other-framework changes

**Verification:** core 1559/1559 · react 2511/2511 (+8, all batch tests pass in isolation) · typecheck clean · lint 0 errors (pre-existing complexity warning) · audit:security 0 · check:manifest ✓ · iris-ui-spec 0 violations · prettier clean · arch-check failure confirmed pre-existing (stale baseline)

**Findings:**

1. **P2** — `audit:tokens` regression: 5 → 7 warnings. Batch CL introduces the first scanned-dir use of `--iris-duration-md` (previously only in `motion/`, which the audit doesn't scan) and the new `--iris-table-expand-max` (Table.tsx:437,440). CK review precedent tracked "no new warnings". Fix: add both to `RUNTIME_INJECTED_VARS` in `scripts/audit-tokens.mjs:132` (mirroring `--iris-cell-bg`/`--iris-anim-*`), verify with `pnpm audit:tokens` — script-only, no manifest regen.
2. **P4** — enter-only animation (collapse unmounts instantly) — the baseline's explicit fiat, not a defect.
3. **P4** — content taller than the 512px cap snaps at the final frame (inherent to max-height keyframes; documented in the CSS comment).

No source files were modified during review.
