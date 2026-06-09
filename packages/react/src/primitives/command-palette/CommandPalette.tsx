import * as React from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../i18n'
import { useBodyScrollLock } from '../../modal-utils/useBodyScrollLock'
import { useFocusTrap } from '../../modal-utils/useFocusTrap'
import { defaultFilter, type IrisCommandItem } from './types'

export interface IrisCommandPaletteProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onSelect'
> {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  items: IrisCommandItem[]
  placeholder?: string
  /** Empty state text when no item matches. */
  emptyText?: string
  /** Custom filter; default is a tolerant subsequence/fuzzy match. */
  filter?: (query: string, item: IrisCommandItem) => number | null
  onSelect?: (item: IrisCommandItem) => void
}

type Row = { kind: 'header'; label: string } | { kind: 'item'; item: IrisCommandItem }

/**
 * Command palette: searchable, keyboard-driven action launcher. Built on the
 * modal-utils suite (scroll lock + focus trap). Pattern: open via shortcut
 * (consumer wires the listener), type to filter, ↑/↓ to navigate, Enter to
 * execute the focused item, Escape to dismiss.
 */
export function IrisCommandPalette({
  open = false,
  onOpenChange,
  items,
  placeholder,
  emptyText,
  filter = defaultFilter,
  onSelect,
  style,
  ...rest
}: IrisCommandPaletteProps): React.ReactElement | null {
  const { t } = useI18n()
  const resolvedPlaceholder = placeholder ?? t('commandPalette.placeholder')
  const resolvedEmptyText = emptyText ?? t('commandPalette.empty')
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const surfaceRef = React.useRef<HTMLDivElement | null>(null)

  const matches = React.useMemo(() => {
    const result: { item: IrisCommandItem; score: number }[] = []
    for (const item of items) {
      const score = filter(query, item)
      if (score !== null) result.push({ item, score })
    }
    result.sort((a, b) => a.score - b.score)
    return result
  }, [items, query, filter])

  // Preserve sort order but inject a header row when the group changes.
  const groupedFlat = React.useMemo<Row[]>(() => {
    const out: Row[] = []
    let currentGroup: string | undefined
    for (const m of matches) {
      const g = m.item.group
      if (g !== currentGroup) {
        if (g) out.push({ kind: 'header', label: g })
        currentGroup = g
      }
      out.push({ kind: 'item', item: m.item })
    }
    return out
  }, [matches])

  // Enabled (navigable) item rows, paired with their index in groupedFlat.
  const itemRows = React.useMemo(() => {
    const out: { item: IrisCommandItem; flat: number }[] = []
    groupedFlat.forEach((row, i) => {
      if (row.kind === 'item' && !row.item.disabled) out.push({ item: row.item, flat: i })
    })
    return out
  }, [groupedFlat])

  // Reset filter + active row whenever (re)opened.
  React.useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
  }, [open])

  // Any query change resets the active row to the top match.
  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useBodyScrollLock(open)
  useFocusTrap({ container: surfaceRef, active: open })

  const close = () => onOpenChange?.(false)

  const runItem = (item: IrisCommandItem) => {
    if (item.disabled) return
    item.action?.()
    onSelect?.(item)
    close()
  }

  const move = (delta: 1 | -1) => {
    const total = itemRows.length
    if (total === 0) return
    setActiveIndex((prev) => (prev + delta + total) % total)
  }

  // Document-level key handling while open — robust for portaled content and
  // lets Escape work even if focus drifts. A ref carries the latest closures so
  // the listener (bound once per open) always sees current activeIndex/itemRows.
  const keyHandlerRef = React.useRef<(e: KeyboardEvent) => void>(() => {})
  keyHandlerRef.current = (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        event.preventDefault()
        move(-1)
        break
      case 'Enter': {
        event.preventDefault()
        const target = itemRows[activeIndex]
        if (target) runItem(target.item)
        break
      }
      case 'Escape':
        event.preventDefault()
        close()
        break
    }
  }
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => keyHandlerRef.current(e)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const node = (
    <div
      data-iris-command-palette-backdrop=""
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        zIndex: 1300,
      }}
    >
      <div
        {...rest}
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('commandPalette.label')}
        data-iris-command-palette=""
        tabIndex={-1}
        style={{
          width: 'min(640px, 92vw)',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--iris-surface)',
          color: 'var(--iris-foreground)',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-lg, 8px)',
          boxShadow: '0 20px 40px -12px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          ...style,
        }}
      >
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--iris-border)' }}>
          <input
            type="text"
            value={query}
            placeholder={resolvedPlaceholder}
            data-iris-command-palette-input=""
            aria-label={t('commandPalette.search')}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 16,
              fontFamily: 'inherit',
              color: 'inherit',
            }}
          />
        </div>
        <ul
          role="listbox"
          aria-label={t('commandPalette.commands')}
          data-iris-command-palette-list=""
          style={{ listStyle: 'none', margin: 0, padding: 4, overflow: 'auto', flex: 1 }}
        >
          {groupedFlat.length === 0 ? (
            <li
              data-iris-command-palette-empty=""
              style={{ padding: 20, textAlign: 'center', color: 'var(--iris-muted)', fontSize: 13 }}
            >
              {resolvedEmptyText}
            </li>
          ) : (
            groupedFlat.map((row, i) => {
              if (row.kind === 'header') {
                return (
                  <li
                    key={`g-${row.label}-${i}`}
                    data-iris-command-palette-group=""
                    style={{
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      color: 'var(--iris-muted)',
                    }}
                  >
                    {row.label}
                  </li>
                )
              }
              const item = row.item
              const enabledIdx = itemRows.findIndex((r) => r.flat === i)
              const isActive = enabledIdx === activeIndex
              return (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={isActive ? 'true' : 'false'}
                  aria-disabled={item.disabled ? 'true' : undefined}
                  data-iris-command-palette-item={item.id}
                  data-state={isActive ? 'active' : item.disabled ? 'disabled' : 'idle'}
                  onClick={() => {
                    if (item.disabled) return
                    setActiveIndex(enabledIdx)
                    runItem(item)
                  }}
                  onMouseEnter={() => {
                    if (!item.disabled) setActiveIndex(enabledIdx)
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 12px',
                    borderRadius: 'var(--iris-radius-sm, 4px)',
                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                    opacity: item.disabled ? 0.5 : 1,
                    background: isActive ? 'var(--iris-surface-hover)' : 'transparent',
                    color: 'inherit',
                    fontSize: 14,
                  }}
                >
                  {item.icon ? (
                    <span aria-hidden="true" style={{ width: 20, textAlign: 'center' }}>
                      {item.icon}
                    </span>
                  ) : null}
                  <span style={{ flex: 1, minWidth: 0 }}>{item.label}</span>
                  {item.shortcut ? (
                    <span
                      data-iris-command-palette-shortcut=""
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        background: 'var(--iris-background)',
                        border: '1px solid var(--iris-border)',
                        borderRadius: 'var(--iris-radius-sm, 4px)',
                        color: 'var(--iris-muted)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {item.shortcut}
                    </span>
                  ) : null}
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
