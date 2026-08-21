import * as React from 'react'
import type { IrisTableEmptyState } from './props'

/** Inline style for the empty-state action button (batch CF, iris 独有 — vxe
 * has no empty-state action): mirrors the error-row retry button token for
 * token — all `--iris-*` tokens, zero magic values. */
export const EMPTY_ACTION_STYLE: React.CSSProperties = {
  border: '1px solid var(--iris-border)',
  background: 'var(--iris-surface)',
  color: 'var(--iris-foreground)',
  borderRadius: 'var(--iris-radius-sm, 4px)',
  padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
  fontSize: 'var(--iris-font-size-sm, 13px)',
  cursor: 'pointer',
}

/** Discriminator guard: a plain object (not null, not an array, not a React
 * element, not a React-internal marker like portals) is the
 * `IrisTableEmptyState` descriptor; every other ReactNode (strings, elements,
 * fragments, portals, iterables) stays on the node path. */
function isEmptyStateObject(
  state: React.ReactNode | IrisTableEmptyState,
): state is IrisTableEmptyState {
  return (
    typeof state === 'object' &&
    state !== null &&
    !Array.isArray(state) &&
    !React.isValidElement(state) &&
    // React portals carry `$$typeof: REACT_PORTAL_TYPE`, which isValidElement
    // misses; any `$$typeof` marker is React-internal, never a descriptor.
    !('$$typeof' in state)
  )
}

/** Empty-state text: descriptor `.text` (or the localized fallback) vs node. */
function emptyTextOf(
  state: React.ReactNode | IrisTableEmptyState,
  fallback: string,
): React.ReactNode {
  return isEmptyStateObject(state) ? (state.text ?? fallback) : (state ?? fallback)
}

/** Empty-state action button descriptor: `.action` only, null otherwise. */
function emptyActionOf(
  state: React.ReactNode | IrisTableEmptyState,
): { label: string; onClick: () => void } | null {
  return isEmptyStateObject(state) ? (state.action ?? null) : null
}

/** Empty row content: node path renders untouched (zero wrapper — existing
 * ReactNode `emptyState` behaves byte-identically); descriptor path renders
 * the text span (12px `marginInlineEnd` when an action follows — error-row
 * retry precedent, RTL-safe) plus the action button on the same centered row. */
export function renderEmptyState(
  state: React.ReactNode | IrisTableEmptyState,
  fallback: string,
): React.ReactNode {
  if (!isEmptyStateObject(state)) return state ?? fallback
  const action = emptyActionOf(state)
  return (
    <>
      <span
        style={{
          marginInlineEnd: action ? 'var(--iris-space-sm, 12px)' : 0,
        }}
      >
        {emptyTextOf(state, fallback)}
      </span>
      {action ? (
        <button
          type="button"
          data-iris-empty-action=""
          onClick={action.onClick}
          style={EMPTY_ACTION_STYLE}
        >
          {action.label}
        </button>
      ) : null}
    </>
  )
}
