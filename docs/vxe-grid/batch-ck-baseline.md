Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-ck-baseline.md` (46 lines). Zero source files touched — git shows only the new baseline plus the pre-existing prior-stage dirt (`DECISIONS.md`, `batch-cj-gate.md`), HEAD `bdc437a9`.

## Summary of the baseline (batch CK：单元格文本搜索高亮 — iris 独有)

**Design** — `searchHighlight?: string` (additive, fail-closed), one core pure splitter, one module helper, two call sites, one token style const. Zero state/effects/handlers/i18n:

- **Prop** after `fnr` in `props.ts` (:541) → manifest **170→171** (events 31 unchanged). Placed in the search-feature family since the spec explicitly contrasts it with fnr.
- **Core NEW `splitSearchHits`** (`search-highlight.ts`, barrel export, `auto-link` precedent): case-insensitive literal substring (fnr parity, no regex), non-overlapping forward scan (fnr replace-all `gi` parity — `'aaa'`+`'aa'` = one hit), alternating `[plain, hit, …]` segments; `null` on empty query/text/no-match → adapter fast-path returns the original string (byte-identical, `detectAutoLink` null-contract).
- **React helper `applySearchHighlight`** (module scope next to `renderAutoLinkCell` :1749 — row-arrow complexity budget flat): non-string nodes and null segments pass through untouched; hits render `<mark data-iris-search-hit>` with `SEARCH_HIT_STYLE`.
- **Two call sites** — the formatter branch (:7678) + raw fallback (:7680): the exact text chain autoLink consumes (mask → formatter ?? raw). Editing/render/html/link/sparkline/autoLink branches untouched (documented fiats — html stays untrusted, link wins, autoLink wins).
- **Style** — `background: var(--iris-surface-selected, …)` — the _same token_ fnrCellStyle uses for matched cells: one search-highlight language across the table; the distinction from fnr is the **mechanism** (fnr = whole-cell background + replace/navigation tool; searchHighlight = pure inline mark, no bar/state/write-back).

**Test plan** — spec's forced 高亮/无匹配 pair mapped explicitly: core 11 cases (hit segments, case-insensitivity, multi-occurrence, non-overlap, no-match/empty → null, zh, literal metacharacters, adjacent, full-string) + react 11 cases (T1/T2 fail-closed, T3/T4 高亮, T5 multi-hit, T6 numeric untouched, T7 formatter string, T8 render/html untouched, T9 link label untouched, T10 **fnr coexistence** — the spec's 与 fnr 区分 proof, T11 rerender/clear).

**File map** — 2 new core files + 2 new react files + 4 touch points in Table.tsx + props.ts + styles.ts + manifest regen + comparison doc row; zero changes to types.ts, i18n, and the other three frameworks.
