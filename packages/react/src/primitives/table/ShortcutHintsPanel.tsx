import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { formatKeyBindings, TABLE_KEY_ACTIONS, type NormalizedTableKeymap } from '@iris-ui-kit/core'

export interface TableShortcutHintsPanelProps {
  open: boolean
  /** Anchor: the toolbar `?` trigger button (a real DOM node). */
  anchorRef: React.RefObject<HTMLElement | null>
  /** The table's EFFECTIVE bindings — defaults + `keymap` overrides, the
   * SAME normalized map every keydown handler matches against (so a listed
   * key always actually works; remaps reflect live via the keymapJson memo). */
  bindings: NormalizedTableKeymap
  onClose: () => void
  t: (key: string, params?: Record<string, string | number>) => string
}

/**
 * Floating keyboard-shortcut reference panel (batch CJ, iris 独有 — vxe has
 * no shortcut help UI). Opens from the toolbar `?` trigger
 * (`data-iris-shortcut-hints-trigger`, after the perf trigger) and floats
 * below it (`useFloating` + portal, like `TableAuditPanel`), closing on
 * Escape / outside pointer-down / any scroll.
 *
 * Content: a read-only list of every built-in shortcut action in canonical
 * `TABLE_KEY_ACTIONS` order — localized label + the formatted effective
 * keys. Single source of truth: the table passes its `keyBindings` memo
 * (the same map every handler matches against), so the panel can never
 * show a binding that doesn't actually work, and `keymap` remaps show up
 * in place. No rebind UI — a reference only. All styling is `--iris-*`
 * tokens; no new tokens/types/events.
 */
export function TableShortcutHintsPanel({
  open,
  anchorRef,
  bindings,
  onClose,
  t,
}: TableShortcutHintsPanelProps): React.ReactElement | null {
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  const { floatingStyles } = useFloating({
    anchor: anchorRef,
    floating: panelRef,
    open,
    placement: 'bottom-end',
    flip: false,
    shift: true,
  })

  // Esc / outside pointer-down / any scroll close the panel. The toolbar
  // trigger is EXCLUDED from the outside-close so a press on it toggles
  // instead of closing-then-reopening (chart/audit panel precedent).
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose
  React.useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const onDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement | null
      if (!target) return
      if (target.closest('[data-iris-shortcut-hints-panel], [data-iris-shortcut-hints-trigger]'))
        return
      onCloseRef.current()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    const onScroll = (): void => onCloseRef.current()
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    document.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  if (!open) return null

  const node = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('table.shortcuts')}
      data-iris-shortcut-hints-panel=""
      style={{
        ...floatingStyles,
        zIndex: 'var(--iris-z-popover, 1000)',
        background: 'var(--iris-surface-floating, var(--iris-surface))',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        boxShadow: 'var(--iris-shadow-lg)',
        padding: 'var(--iris-space-sm, 12px)',
        minWidth: 240,
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--iris-space-xs, 8px)',
        fontSize: 'var(--iris-font-size-sm, 13px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--iris-space-xs, 8px)' }}>
        <span data-iris-shortcut-hints-title="" style={{ fontWeight: 600, flex: 1 }}>
          ? {t('table.shortcuts')}
        </span>
      </div>
      <div
        data-iris-shortcut-hints-list=""
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--iris-space-xxs, 4px)',
          maxHeight: 260,
          overflowY: 'auto',
        }}
      >
        {TABLE_KEY_ACTIONS.map((action) => (
          <div
            key={action}
            data-iris-shortcut-row=""
            data-iris-shortcut-action={action}
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 'var(--iris-space-sm, 12px)',
              padding: 'var(--iris-space-xxs, 4px) 0',
              borderBottom: '1px solid var(--iris-border-subtle, var(--iris-border))',
              fontSize: 'var(--iris-font-size-xs, 12px)',
            }}
          >
            <span style={{ color: 'var(--iris-muted)' }}>{t(`table.shortcuts.${action}`)}</span>
            <span
              data-iris-shortcut-keys=""
              style={{
                color: 'var(--iris-foreground)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatKeyBindings(bindings[action])}
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(node, document.body)
}
