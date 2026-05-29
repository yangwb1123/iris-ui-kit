import * as React from 'react'

export type IrisToolbarOrientation = 'horizontal' | 'vertical'

export interface IrisToolbarProps {
  children?: React.ReactNode
  orientation?: IrisToolbarOrientation
  ariaLabel?: string
  style?: React.CSSProperties
  className?: string
}

const SELECTOR = 'button, [href], input, select, textarea, [tabindex]'

/**
 * Toolbar: a `role="toolbar"` grouping of actions with roving-tabindex keyboard
 * navigation — one item is in the tab order, and Arrow keys (per orientation)
 * plus Home/End move focus and the tab stop between the focusable children.
 *
 * React port of {@link import('@iris-ui/vue').IrisToolbar}.
 */
export function IrisToolbar({
  children,
  orientation = 'horizontal',
  ariaLabel,
  style,
  className,
}: IrisToolbarProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement | null>(null)

  const items = React.useCallback((): HTMLElement[] => {
    const root = ref.current
    if (!root) return []
    return (Array.from(root.querySelectorAll(SELECTOR)) as HTMLElement[]).filter(
      (el) => !el.hasAttribute('disabled'),
    )
  }, [])

  React.useEffect(() => {
    items().forEach((el, i) => {
      el.tabIndex = i === 0 ? 0 : -1
    })
  }, [items])

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
    const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
    const list = items()
    if (list.length === 0) return
    const cur = list.indexOf(document.activeElement as HTMLElement)
    let target: number
    if (e.key === nextKey) target = ((cur < 0 ? 0 : cur) + 1) % list.length
    else if (e.key === prevKey) target = ((cur < 0 ? 0 : cur) - 1 + list.length) % list.length
    else if (e.key === 'Home') target = 0
    else if (e.key === 'End') target = list.length - 1
    else return
    e.preventDefault()
    list.forEach((el, i) => {
      el.tabIndex = i === target ? 0 : -1
    })
    list[target]?.focus()
  }

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-orientation={orientation}
      aria-label={ariaLabel}
      data-iris-toolbar=""
      data-orientation={orientation}
      className={className}
      onKeyDown={onKeyDown}
      style={{
        display: 'inline-flex',
        flexDirection: orientation === 'vertical' ? 'column' : 'row',
        alignItems: 'center',
        gap: 4,
        ...style,
      }}
    >
      {children}
    </div>
  )
}
