import * as React from 'react'
import {
  copyText,
  detectAutoLink,
  matchConditionalStyles,
  splitSearchHits,
} from '@iris-ui-kit/core'
import { applyCellMask } from './exportCsv'
import type { IrisTableColumn, IrisTableConditionalStyle } from './types'
import { SEARCH_HIT_STYLE } from './styles'

/** Read clipboard text; null when unavailable or denied (jsdom: no-op). */
export async function readClipboardText(): Promise<string | null> {
  const nav = navigator as Navigator & { clipboard?: { readText?: () => Promise<string> } }
  if (!nav.clipboard?.readText) return null
  try {
    return await nav.clipboard.readText()
  } catch {
    return null
  }
}

/**
 * Batch BW: the display text of a context-menu cell — `applyCellMask` mask
 * first, formatter second, `String` coercion (null/undefined → '') — the
 * SAME display chain as the cell body and `cellTooltip`, so the 复制值 quick
 * action copies exactly what the user sees.
 */
export function contextCellText<Row extends Record<string, unknown>>(
  row: Row,
  col: IrisTableColumn<Row>,
  resolveValue: (row: Row, col: IrisTableColumn<Row>) => unknown,
): string {
  const displayValue = applyCellMask(resolveValue(row, col), col)
  if (col.formatter) {
    const formatted = col.formatter(displayValue, row)
    if (typeof formatted === 'string') return formatted
  }
  return String(displayValue ?? '')
}

/**
 * Batch CA (iris 独有 — vxe has no auto-link): the `autoLink` cell body —
 * the same display chain as `contextCellText` (mask → formatter ?? raw) —
 * renders an `<a data-iris-auto-link>` only when the final text is a string
 * that core `detectAutoLink` matches (whole-text URL/email, _blank +
 * noreferrer, click does not bubble into row/range handlers). Non-matching
 * text falls through to the formatter/raw branches byte-identically (a
 * non-string formatter result or non-string raw value returns it as-is, so
 * this branch is a drop-in replacement for the plain path).
 */
export function renderAutoLinkCell<Row extends Record<string, unknown>>(
  row: Row,
  col: IrisTableColumn<Row>,
  resolveValue: (row: Row, col: IrisTableColumn<Row>) => unknown,
): React.ReactNode {
  const displayValue = applyCellMask(resolveValue(row, col), col)
  let detected: string | null = null
  let text: string | null = null
  if (col.formatter) {
    const formatted = col.formatter(displayValue, row)
    if (typeof formatted !== 'string') return formatted
    text = formatted
  } else if (typeof displayValue === 'string') {
    text = displayValue
  } else {
    return displayValue as React.ReactNode
  }
  detected = detectAutoLink(text)
  if (!detected) return text
  return (
    <a
      data-iris-auto-link=""
      href={detected}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      {text}
    </a>
  )
}

/**
 * Batch CK (iris 独有 — vxe has no inline search highlight): the
 * `searchHighlight` cell body — the same display chain as the plain
 * formatter/raw branches (mask → formatter ?? raw, exactly what autoLink
 * consumes) — renders a `<mark data-iris-search-hit>` around every
 * case-insensitive literal occurrence of the query (core `splitSearchHits`,
 * odd segment indices are hits). Non-string nodes and null segments (empty
 * query / empty text / no match) pass through untouched, so this branch is
 * a drop-in replacement for the plain path — byte-identical without the
 * prop (fail-closed).
 */
export function applySearchHighlight(
  node: React.ReactNode,
  query: string | undefined,
): React.ReactNode {
  if (!query || typeof node !== 'string') return node
  const segments = splitSearchHits(node, query)
  if (!segments) return node
  return segments.map((seg, i) =>
    i % 2 === 1 ? (
      <mark key={i} data-iris-search-hit="" style={SEARCH_HIT_STYLE}>
        {seg}
      </mark>
    ) : (
      seg
    ),
  )
}

/**
 * Write clipboard text — best-effort, ordered: registered host handler
 * (core `copyText`) → `navigator.clipboard.writeText` → hidden-textarea
 * `execCommand('copy')` fallback. In test environments without a clipboard
 * stub every step no-ops safely (never throws). Returns `true` when at
 * least one channel actually took the copy — the batch-CE copy-feedback
 * highlight gates on this (spec: “复制成功后”).
 */
export async function writeClipboardText(text: string): Promise<boolean> {
  if (await copyText(text)) return true
  const nav = navigator as Navigator & { clipboard?: { writeText?: (t: string) => Promise<void> } }
  if (nav.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(text)
      return true
    } catch {
      /* permission denied — fall through to the legacy path */
    }
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    /* no-op */
  }
  ta.remove()
  return copied
}

/** Case-insensitive replace of every occurrence (fnr replace / replace-all). */
export function replaceAllOccurrences(text: string, query: string, replacement: string): string {
  if (query === '') return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Function replacement keeps `$` patterns in the replacement literal.
  return text.replace(new RegExp(escaped, 'gi'), () => replacement)
}

/**
 * Cell background/color for fnr highlighting, folded into the cell style:
 * active match → primary fill, any match → surface-selected, otherwise the
 * pre-existing range/striped logic. Token-driven only (no raw colors).
 * BACKGROUND-COLOR longhand (batch BE): the `background` shorthand would
 * reset background-image — silently killing the locked-cell stripes and
 * tripping React's shorthand/longhand mixing warning on rerender.
 */
export function fnrCellStyle(
  fnrActive: boolean,
  fnrMatched: boolean,
  rangeSelected: boolean,
  stripedRow: boolean,
): React.CSSProperties {
  return {
    backgroundColor: fnrActive
      ? 'var(--iris-primary, #6366f1)'
      : fnrMatched || rangeSelected
        ? 'var(--iris-surface-selected, rgba(99,102,241,0.12))'
        : stripedRow
          ? 'var(--iris-surface)'
          : 'transparent',
    ...(fnrActive ? { color: 'var(--iris-primary-foreground, #fff)' } : null),
  }
}

/**
 * Batch AX conditional formatting: fold the ordered rule list into the body
 * cell's inline style — rules evaluate in array order and later matches win
 * (the same spread-order latitude `cellStyle` already has). The `value` is
 * the raw cell value (getCellValue: dataIndex ?? key, formula computed).
 * Early-returns null when no rules are set; inline per-cell evaluation with
 * cost = visibleCells × rules (no memo — virtual scroll bounds the cell
 * count and callers memoize the rules array).
 */
export function conditionalCellStyle<Row extends Record<string, unknown>>(
  rules: readonly IrisTableConditionalStyle<Row>[] | undefined,
  row: Row,
  columnKey: string,
  value: unknown,
): React.CSSProperties | null {
  if (!rules || rules.length === 0) return null
  const merged = matchConditionalStyles(rules, row, columnKey, value)
  return Object.keys(merged).length > 0 ? merged : null
}

/**
 * Batch DH (iris 独有): the active pattern-edit hint — the column being edited
 * plus its live draft (resolved from the cell-edit store). While a session is
 * open, cells in the SAME column whose committed RAW value equals the draft
 * highlight, so other rows sharing the value stay visible as a data-
 * consistency cue. The editing cell itself is exempt; an empty draft is
 * fail-closed (never floods a whole empty column). Row-edit mode never
 * resolves here (each column's draft lives in its own session — documented
 * fiat, inline cell mode is fully realtime via the shared store).
 */
export interface PatternEditActive {
  columnKey: string
  draft: unknown
}

/** Shared background for pattern-edit hints (token with a default fallback). */
const PATTERN_HINT_BG =
  'linear-gradient(var(--iris-input-hint, rgba(251, 191, 36, 0.16)), var(--iris-input-hint, rgba(251, 191, 36, 0.16)))'

/**
 * Per-cell pattern hint resolution: whether this cell highlights + its style.
 * Longhand background-image only (BE discipline) — never clobbers
 * background-image, spread AFTER conditional styles / BEFORE lockedRender.
 */
export function patternHintStyle(
  active: PatternEditActive | null,
  colKey: string,
  isEditing: boolean,
  raw: unknown,
): { hint: boolean; style?: React.CSSProperties } {
  if (!active || active.columnKey !== colKey || isEditing) return { hint: false }
  const draftStr = String(active.draft)
  if (draftStr === '') return { hint: false }
  if (String(raw) !== draftStr) return { hint: false }
  return { hint: true, style: { backgroundImage: PATTERN_HINT_BG } }
}
