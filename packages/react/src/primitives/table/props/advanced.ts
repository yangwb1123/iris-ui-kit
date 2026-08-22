import type * as React from 'react'
import type * as TableTypes from '../types'
import type { IrisTablePagerConfig } from '../props'
export interface IrisTableAdvancedProps<
  Row extends Record<string, unknown> = Record<string, unknown>,
> {
  nlSummary?: boolean
  /**
   * Mini chart preview (batch AR, iris 独有): when true, the toolbar gains a
   * chart trigger (`data-iris-chart-trigger`) opening a floating panel
   * (`data-iris-chart-panel`) that charts the CURRENT filtered rows: a
   * numeric-column select (columns where `typeof getCellValue(row, col) ===
   * 'number'` for some row, or `col.summary === 'sum'`) plus a bar/line kind
   * toggle. The SVG (viewBox 0 0 300 120) is built from the core
   * `buildChartData` material over the first 20 values (a muted "共 N 行"
   * note when truncated) — structured JSX only, no SVG strings. Token colors
   * only; Esc / outside / scroll close it. Requires a toolbar render (the
   * gate admits `chartPreview` like `undo`).
   */
  chartPreview?: boolean
  /**
   * Auto-refresh (batch AS, iris 独有 — vxe has no interval refresh): when
   * set, the table re-queries the proxy every `intervalMs` ms while in proxy
   * mode (non-proxy `data` tables are inert — there is nothing to refetch).
   * Each tick calls the SAME refetch the built-in ↻ button uses — the
   * standard refetch path, so `loading` flips true for the duration of the
   * request (the core source has no silent-refresh option; documented
   * behavior, not suppressed). `intervalMs` ≤ 0 disables the timer
   * (fail-closed). The interval restarts whenever `intervalMs` changes
   * (keyed on the scalar, so an inline object doesn't reset the timer every
   * render) and is cleared on unmount / proxy removal. Additive — default
   * off.
   */
  autoRefresh?: { intervalMs: number }
  /**
   * Freshness stamp (batch AS, iris 独有 — vxe shows no data-arrival time):
   * when true, the toolbar renders `Updated at HH:MM:SS`
   * (`data-iris-freshness`, i18n `table.freshness`, 24h local `formatClock`)
   * re-stamped on EVERY live-data change — initial arrival, refetch, edit
   * commit, row ops / paste / batch / range clear, undo/redo (everything
   * that funnels through `setLiveData`). Hidden until the first row exists
   * (`liveData.length === 0`). Requires a toolbar render. Additive — default
   * off.
   */
  freshness?: boolean
  /**
   * Validation summary (batch BR, iris 独有 — vxe shows no editRules outcome
   * counts): when true, the toolbar renders a muted commit-outcome ledger
   * (`data-iris-validation-summary`, i18n `table.validationSummary`, en
   * `Passed {ok} · Failed {fail}` / zh `通过 {ok} · 失败 {fail}`) for columns
   * with declarative `editRules`: ok = a commit that passed editRules and
   * landed (cell and row edit modes), fail = a commit attempt rejected by
   * editRules. Typing-time validation, legacy `validate` columns, paste/fill/
   * FNR/batch bypasses and Escape cancels never count. Hidden until at least
   * one outcome is counted; re-enabling the switch resets the ledger.
   * Requires a toolbar render (the gate admits `validationSummary` like
   * `freshness`). Additive — default off.
   */
  validationSummary?: boolean
  /**
   * Audit log (batch AT, iris 独有 — vxe has no audit trail): when true, every
   * mutation commit appends ONE entry to a bounded (200) ring — inline/row
   * edits, insert/remove row ops, paste, fill, batch edit, undo/redo replay
   * (type hint per site; rowKey + first-changed-cell context from a light
   * diff of the row lists, documented simplification). The toolbar gains an
   * audit trigger (`data-iris-audit-trigger`) opening a floating panel
   * (`data-iris-audit-panel`, like the chart/stats panels — Esc / outside /
   * scroll close) listing newest-first entries (seq + `formatClock` time +
   * type + rowKey + column + muted old→new). `tableRef.getAuditLog()` /
   * `clearAuditLog()` expose the trail programmatically (the seq never
   * resets on clear — audit integrity). Requires a toolbar render (the gate
   * admits `auditLog` like `undo`). Additive — default off.
   */
  auditLog?: boolean
  /**
   * Performance panel (batch BL, iris 独有 — vxe has no perf stats): when
   * true, every render commit samples `nowMs()` (render-top mark →
   * dependency-less `useLayoutEffect` run) into a core `createPerfStats`
   * latest-snapshot controller (`@iris-ui-kit/core/perf-stats` — own
   * subpath). Duration = render + layout phase, excludes paint
   * (documented). The toolbar gains a ⚡ trigger (`data-iris-perf-trigger`)
   * opening a floating panel (`data-iris-perf-panel`, like the audit panel
   * — Esc / outside / scroll close) showing the last render duration,
   * row count, leaf-column count and the audit-trail depth — live: the
   * panel subscribes to BOTH controllers, so `tableRef.clearAuditLog()`
   * refreshes the changes count in place; `auditLog` off → muted `—`. The
   * push notifies only the panel (separate portal root) — the table never
   * re-renders from its own measurement. Requires a toolbar render (the
   * gate admits `perfStats` like `auditLog`). Off = zero cost. Additive —
   * default off.
   */
  perfStats?: boolean
  /**
   * Version history (batch BA, iris 独有 — vxe has no time-travel): when set,
   * every row-list commit (`commitRowList` — row ops, paste, fill, range
   * clear, batch edit, undo/redo replay) pushes the PRE-change rows into a
   * bounded ring (core `createVersionHistory`, default max 20; `max: 0`
   * unlimited; `max` read once at mount). The toolbar gains a history trigger
   * (`data-iris-history-trigger`) opening a floating panel
   * (`data-iris-history-panel`, like the audit panel — Esc / outside / scroll
   * close) listing versions newest-first (#index + `formatClock` time + commit
   * type); clicking an entry restores those rows through the normal write-back
   * channel (`commitRowList(rows, 'undo')` — auditable and undoable) WITHOUT
   * pushing a new version. Inline cell/row edits (the `commitValue` funnel)
   * don't create versions (documented — restore replaces the whole row list,
   * so row-level commits are the coherent unit). `tableRef.getVersions()`
   * (lightweight — no rows) / `restoreVersion(index)` expose the ring
   * programmatically. Requires a toolbar render (the gate admits
   * `versionHistory` like `undo`). Additive — default off.
   */
  versionHistory?: { max?: number }
  /**
   * Compare view (batch AU, iris 独有 — vxe has no compare capability): a
   * snapshot the live rows are diffed against by `rowKey`. Every live row
   * absent from the snapshot renders `data-iris-row-removed`, every live row
   * present in both with ≥1 differing cell renders `data-iris-row-changed`
   * with `data-iris-cell-changed` on the changed cells and a title tooltip
   * `旧值: X → 新值: Y` (old = live value, new = snapshot value) that
   * overrides the tooltipConfig title (compare wins, documented); snapshot-
   * only rows are `added` in the core diff but have no rendered slot — the
   * compare view renders the live dataset (documented). Core `diffRows` is
   * framework-free; the memo is null without `compareWith` or `rowKey` —
   * additive, default off.
   */
  compareWith?: Row[]
  /**
   * Cell auto-link (batch CA, iris 独有 — vxe has no URL/email auto-
   * detection): when true, text cells run their display chain
   * (mask → formatter ?? raw) through core `detectAutoLink`; a whole-text
   * URL/email match renders an `<a data-iris-auto-link>` (_blank +
   * noreferrer) instead of plain text. Non-matching text falls through to
   * the formatter/raw branch unchanged; an explicit `col.link` column still
   * wins (evaluated before autoLink). Additive — default off.
   */
  autoLink?: boolean
  /**
   * Recent filters (batch CB, iris 独有 — vxe has no "recent filters"
   * concept): when true, every filter-panel confirm (non-empty checked
   * set) records `{ key, values, ts }` into a core `createRecentFilters`
   * ring (newest-first, 10 entries, MRU — re-confirming the same set
   * bumps it to the top). The filter panel shows the recent entries
   * above the options; clicking one applies it immediately (across
   * columns) and closes. Additive — default off.
   */
  recentFilters?: boolean
  /**
   * Edit-history sidebar (batch DB, iris 独有 — vxe has no edit history): a
   * right-side drawer panel (portal, `position: fixed`, 360px, NO backdrop —
   * non-modal) opened from the toolbar trigger (`data-iris-edit-sidebar-trigger`,
   * ⏳ right after the version-history trigger). It merges the batch-AT audit
   * ring and the batch-BA version ring into ONE timeline view, newest-first
   * (`at` desc; a same-ms tie lists the audit entry ABOVE its version — the
   * deterministic record-order arbitration). Version entries are clickable:
   * pressing one restores those rows through the normal write-back channel
   * (`commitRowList(rows, 'undo')` — auditable and undoable) WITHOUT pushing a
   * new version, exactly like the version-history panel, and closes. Audit
   * entries render seq + `formatClock` time + type + rowKey + column + muted
   * old→new. Fail-closed matrix: a recording layer whose prop is OFF
   * contributes NOTHING — the record layers are never implicitly enabled, so
   * with only `versionHistory` the panel lists versions alone, with only
   * `auditLog` audit entries alone, and with neither the empty state. The
   * panel subscribes to BOTH controllers (`useSyncExternalStore` each) so a
   * commit while it is open refreshes the timeline in place. Closes on Esc /
   * outside pointer-down / any scroll; the trigger is exempt (a press on it
   * toggles instead of close-then-reopen). Requires a toolbar render (the
   * gate admits `editSidebar` like `versionHistory`). Additive — default off.
   */
  editSidebar?: boolean
  /**
   * Imperative handle (vxe-grid edit insert/remove/setRow parity + iris-only
   * additions): row ops, proxy/view/selection methods, and (batch BZ) the
   * full view-state JSON export/import — `exportStateJson()` /
   * `importStateJson(json)` (sort / filters / filterValues /
   * columnVisibility / columnOrder / columnWidths / pageSize / expandedKeys /
   * query — the same collector as `persistState`).
   */
  tableRef?: React.MutableRefObject<TableTypes.IrisTableHandle<Row> | null>
  /** Fired after any internal row operation / edit write-back, with the new row list. */
  onDataChange?: (rows: Row[]) => void
  /** Veto rows from selection (vxe-grid checkboxConfig.checkMethod parity). */
  checkMethod?: (row: Row, rowIndex: number) => boolean
  /** Pager options (vxe-grid pagerConfig parity). */
  pagerConfig?: IrisTablePagerConfig
  /** Fixed height (vxe-grid height parity, batch N): makes the root a vertical
   * scroll container with a sticky header row. Number → px; string → CSS length. */
  height?: number | string
  /** Minimum height of the fixed-height container (with `height`/`maxHeight`). */
  minHeight?: number | string
  /** Maximum height of the fixed-height container (with `height`/`minHeight`). */
  maxHeight?: number | string
  /** Thin scrollbars (vxe-grid scrollbarConfig parity, batch Q): when
   * `theme: 'thin'`, the root and its virtual-scroll descendant get 6px
   * webkit scrollbars plus Firefox `scrollbar-width: thin` via
   * `data-iris-scrollbar-thin`. Default: browser scrollbars. */
  scrollbarConfig?: { theme?: 'default' | 'thin' }
  /** Batch DP (iris 独有): add token-driven custom thumb styling to the native
   * scrollbar while retaining native scrolling and accessibility. */
  scrollbarThumb?: boolean
  /**
   * Back-to-top (batch EA, iris 独有 — vxe has no floating back-to-top): when
   * true, a 40×40 round ↑ button floats at the scroll viewport's bottom-right
   * once the table's effective scroller scrolls past 200px (the fixed-height
   * root, vxe-grid `height` parity, or the virtual-scroll viewport — the
   * viewport wins when both exist, the same resolution the paging keys use).
   * Clicking it scrolls back to the top (`scrollTo({ top: 0, behavior })` with
   * a `scrollTop = 0` fallback; reduced-motion users get `'auto'`). The
   * anchor is a sticky zero-height endcap (absolute-in-anchor corner button,
   * z 3 above the sticky header / pinned columns) — zero layout footprint,
   * no dead scroll tail — and the button disappears once the scroller returns
   * above the threshold. Non-scrollable tables never show it (fail-closed);
   * printable tables suppress it. Additive — default off.
   */
  scrollToTop?: boolean
  /** Batch DN (iris 独有): show count/average statistics for numeric columns
   * inside their leaf headers, separate from footer/column totals. */
  headerStats?: boolean
  /** Dirty-cell tracking (vxe-grid editDirtyConfig parity, batch Q): a cell
   * whose committed value differs from its pre-edit original renders a
   * primary dot (`data-iris-cell-dirty`, cell gets `position: relative`);
   * committing the original value clears it. `indicator: false` suppresses
   * the dot (tracking stays); `className: true` also adds an
   * `iris-table-cell-dirty` class for custom styling. */
  editDirtyConfig?: { indicator?: boolean; className?: boolean }
  /** Fill the parent (vxe-grid auto-resize parity, batch Q): a
   * ResizeObserver measures the root and, when no explicit `height` is set,
   * renders `height: 100%` so the table fills AND tracks its parent (the
   * fixed-height scroll machinery engages after the first positive
   * measure). When `height` IS set the measured size is kept internally and
   * the explicit height wins (no visible change). Without ResizeObserver
   * (jsdom/SSR) the scroll engagement is a no-op. Default false. */
  autoResize?: boolean
  /**
   * Re-measure on content changes (vxe-grid syncResize parity, batch R):
   * when true, `autoResize` is off and NO explicit `height` is set, an
   * effect keyed on data / loading / error / footerData / size / bordered
   * runs the SAME root measure autoResize uses (plus on
   * `visibilitychange`), so the fixed-height machinery tracks
   * content-driven size changes without a ResizeObserver. Same application
   * rules as `autoResize`: with `height` set the explicit height wins and
   * the effect does nothing. Default false. */
  syncResize?: boolean
  /**
   * Narrow-width responsive mode (iris 独有 — vxe has no responsive column
   * behavior): a prop-gated ResizeObserver measures the root; when the
   * container measures below 480px (strictly — 480 exactly is full width),
   * the lowest-priority top-level columns are greedily hidden until the
   * natural width fits (pinned columns survive, at least one column stays),
   * and — only when columns STILL overflow after collapsing — a horizontal
   * scroll hint bar (`data-iris-scroll-hint`) + root overflowX auto appear
   * so no data is unreachable. At/above 480px, without ResizeObserver
   * (jsdom/SSR) or with the prop off, the render is byte-identical. Default
   * false. */
  responsive?: boolean
  /**
   * Seed the live row list with a COPY of `data` (vxe-grid keepSource
   * parity, batch R): `liveData` initializes to `[...data]` instead of the
   * `data` reference, so mutating the original array after mount cannot
   * change the table. The table is immutable either way — it never mutates
   * the rows it receives; `keepSource` just decouples the initial seed.
   * Later controlled re-feeds (new `data` reference) keep the hand-off. */
  keepSource?: boolean
  /**
   * Root stacking (vxe-grid zIndex parity, batch R): sets `z-index` on the
   * root with `position: relative` (CSS z-index is inert on static
   * elements). Rendered before `style` — a caller-provided style can still
   * override. */
  zIndex?: number
  /** Highlight rows on hover (vxe highlight-hover-row parity, batch N). Default true. */
  highlightHoverRow?: boolean
  /** Header overflow (vxe showHeaderOverflow parity, batch W): when false, header cells switch to `whiteSpace: 'normal'` + `overflow: 'visible'` (text wraps instead of the ellipsis). Default true. */
  showHeaderOverflow?: boolean
  /** Footer overflow (vxe showFooterOverflow parity, batch W): when false, summary / footerMethod / footerData cells switch to `whiteSpace: 'normal'` + `overflow: 'visible'` (text wraps instead of the ellipsis). Default true. */
  showFooterOverflow?: boolean
  /** Background watermark text (iris 独有 — vxe has no watermark concept): when set, a rotated tiled watermark layer (wrapper `data-iris-watermark` → overlay `data-iris-watermark-overlay` → tiles `data-iris-watermark-tile`, same DOM shape as the standalone IrisWatermark primitive) overlays the table's static rows / footer / pager — below the sticky header, pinned columns and floating panels. The wrapper is a sticky first child of the root (the scroll container), so in fixed-height mode it pins to the scroll viewport and stays put while rows scroll beneath. Pure display: `aria-hidden` + `pointer-events: none` + `user-select: none`, token-driven (`--iris-muted` / `--iris-space-xl` / `--iris-font-size-lg`). Empty string hides the layer. */
  watermark?: string
  style?: React.CSSProperties
  className?: string
}
