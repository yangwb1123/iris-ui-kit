import * as React from 'react'
import { createPortal } from 'react-dom'
import { useFloating } from '../../floating/useFloating'
import { MenuContext, useMenuContext } from './context'

const HOVER_OPEN_DELAY = 100

export interface IrisMenuSubProps {
  label?: React.ReactNode
  portalTarget?: HTMLElement | false
  children?: React.ReactNode
}

/**
 * Nested submenu. Renders its own trigger (a `[role="menuitem"]` inside the
 * parent menu) and floating content panel. Opens on hover (with a short
 * delay) and on ArrowRight / Enter; closes on ArrowLeft.
 *
 * Inherits `closeRoot` from the surrounding `IrisMenu` so picking a leaf
 * collapses the whole tree.
 */
export function IrisMenuSub({
  label,
  portalTarget,
  children,
}: IrisMenuSubProps): React.ReactElement {
  const parentCtx = useMenuContext('IrisMenuSub')

  const [open, setOpenState] = React.useState(false)
  const triggerRef = React.useRef<HTMLElement | null>(null)
  const contentRef = React.useRef<HTMLElement | null>(null)
  const openTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = React.useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current)
      openTimerRef.current = null
    }
  }, [])

  const scheduleOpen = () => {
    clearTimer()
    openTimerRef.current = setTimeout(() => {
      setOpenState(true)
      openTimerRef.current = null
    }, HOVER_OPEN_DELAY)
  }

  React.useEffect(() => clearTimer, [clearTimer])

  const { floatingStyles } = useFloating({
    anchor: triggerRef,
    floating: contentRef,
    open,
    placement: 'right-start',
    offset: -4,
  })

  const setOpen = React.useCallback((v: boolean) => setOpenState(v), [])

  // Focus management on open/close.
  const wasOpenRef = React.useRef(false)
  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      queueMicrotask(() => {
        const first = contentRef.current?.querySelector<HTMLElement>('[role="menuitem"]')
        first?.focus()
      })
    } else if (!open && wasOpenRef.current) {
      triggerRef.current?.focus?.()
    }
    wasOpenRef.current = open
  }, [open])

  const onTriggerClick = (e: React.MouseEvent) => {
    if (e.defaultPrevented) return
    clearTimer()
    setOpenState((prev) => !prev)
  }
  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpenState(true)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setOpenState(false)
    }
  }

  const onContentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const items = Array.from(
        contentRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitem"]:not([aria-disabled="true"])',
        ) ?? [],
      )
      if (items.length === 0) return
      const index = items.indexOf(document.activeElement as HTMLElement)
      const next =
        e.key === 'ArrowDown'
          ? index < 0
            ? 0
            : (index + 1) % items.length
          : index <= 0
            ? items.length - 1
            : index - 1
      items[next]?.focus()
    } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpenState(false)
    } else if (e.key === 'Tab') {
      parentCtx.closeRoot()
    }
  }

  const ctxValue = React.useMemo(
    () => ({
      open,
      setOpen,
      triggerRef,
      contentRef,
      contentId: '',
      placement: 'right-start' as const,
      offset: 0,
      closeRoot: parentCtx.closeRoot,
    }),
    [open, setOpen, parentCtx.closeRoot],
  )

  const trigger = (
    <div
      ref={(el) => {
        triggerRef.current = el
      }}
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={open}
      tabIndex={0}
      data-iris-menu-sub-trigger=""
      data-state={open ? 'open' : 'closed'}
      onPointerEnter={scheduleOpen}
      onPointerLeave={clearTimer}
      onClick={onTriggerClick}
      onKeyDown={onTriggerKeyDown}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--iris-gap-sm, 6px)',
        padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
        borderRadius: 'var(--iris-radius-sm, 4px)',
        cursor: 'pointer',
        outline: 'none',
        fontSize: 'var(--iris-font-size-md, 14px)',
        background: open ? 'var(--iris-surface-hover)' : 'transparent',
      }}
    >
      <span>{label}</span>
      <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12">
        <path
          d="M6 4l4 4-4 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )

  const content = open ? (
    <div
      ref={(el) => {
        contentRef.current = el
      }}
      role="menu"
      tabIndex={-1}
      data-iris-menu-sub=""
      data-state="open"
      onKeyDown={onContentKeyDown}
      onPointerEnter={clearTimer}
      style={{
        ...floatingStyles,
        background: 'var(--iris-surface)',
        color: 'var(--iris-foreground)',
        border: '1px solid var(--iris-border)',
        borderRadius: 'var(--iris-radius-md, 6px)',
        padding: 'var(--iris-padding-sm, 4px)',
        boxShadow: 'var(--iris-shadow-lg)',
        minWidth: 180,
        outline: 'none',
        zIndex: 1001,
      }}
    >
      <MenuContext.Provider value={ctxValue}>{children}</MenuContext.Provider>
    </div>
  ) : null

  const portaled =
    content && portalTarget !== false && typeof document !== 'undefined'
      ? createPortal(content, portalTarget ?? document.body)
      : content

  return (
    <>
      {trigger}
      {portaled}
    </>
  )
}
