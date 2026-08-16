## Verdict: **PASS** — written to `docs/vxe-grid/batch-ck-review.md`

### What I checked

**Spec correctness** — every baseline point verified against the code:

- `searchHighlight?: string` after `fnr` (`props.ts:551`) → manifest 170→171, events 31 ✓
- Core `splitSearchHits` (`packages/core/src/search-highlight.ts`): case-insensitive literal `indexOf` scan (no regex), non-overlapping (`'aaa'`+`'aa'` = one hit), alternating segments with odd indices = hits, `null` fail-closed on empty/no-match. Hand-traced all test vectors — correct.
- `applySearchHighlight` (`Table.tsx:1793`): non-strings/null pass through untouched; exactly **two** call sites (formatter `:7727` + raw fallback `:7730`) at the tail of the `mask → formatter ?? raw` chain; render/html/link/sparkline/autoLink untouched (autoLink wins, documented fiat) ✓
- `SEARCH_HIT_STYLE` (`styles.ts:146`) uses the **same** `--iris-surface-selected` token as `fnrCellStyle`; all other props are `--iris-*` tokens ✓
- Test plan: core 11 + react 11 (incl. the spec's 与 fnr 区分 T10 coexistence test) — all present ✓

**Additive only** — 10 files in commit `d208c8fc`: 2 new core files, 1 new react test, 3 react touch points, manifest regen, 2 docs. Zero changes to types.ts/i18n/other frameworks (manifest confirms `searchHighlight` only in the react contract). No uncommitted source changes.

**Manifest hygiene** — `check:manifest` up to date; propCount 171, events 31 ✓

**Core framework-free** — grep for framework imports in `core/src` empty ✓

**Verification (all green)**: core test 1559/1559 (+11) · react test 2503/2503 (+11) · react typecheck clean · react lint 0 errors (1 pre-existing complexity warning, documented since batch AH) · iris-ui-spec.py 0 violations · check:manifest up to date · audit:tokens adds no new warnings (2 pre-existing, unrelated).

### Findings

1. **P4 (cosmetic)** — `props.ts:549-550`: JSDoc line-wrap produces "`render`/ `html`" (stray space after slash) in the generated manifest description. Content is complete (fail-closed ending intact — the batch-CJ lesson is fixed). Fix: reflow the backticked token list onto one line, regen. Non-blocking.
2. **P4 (info)** — baseline file map says "2 new react files" but only 1 exists (`search-highlight.test.tsx`); the helper lives in `Table.tsx` per the baseline's own design section. Baseline prose inconsistency only; implementation matches the operative design. No action.

No source files were modified during review.
