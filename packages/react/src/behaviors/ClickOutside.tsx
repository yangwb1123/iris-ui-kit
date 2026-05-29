import * as React from 'react'

export interface IrisClickOutsideProps {
  onOutside: (event: PointerEvent) => void
  /** Disable detection (no-op if true). */
  disabled?: boolean
  /**
   * Additional refs whose elements are also treated as "inside" (clicks
   * against them won't fire `onOutside`). Useful for trigger buttons that
   * live outside the wrapper but should still keep it open.
   */
  ignore?: Array<React.RefObject<HTMLElement | null>>
  children?: React.ReactNode
}

/**
 * Behavior wrapper: fires `onOutside` when a pointerdown happens outside
 * the wrapped child tree. Renders a thin `<span style="display:contents">`
 * to capture the child's bounding box without disrupting layout.
 *
 * @example
 *   <IrisClickOutside onOutside={() => setOpen(false)}>
 *     <IrisPopoverContent>…</IrisPopoverContent>
 *   </IrisClickOutside>
 */
export function IrisClickOutside({
  onOutside,
  disabled = false,
  ignore = [],
  children,
}: IrisClickOutsideProps): React.ReactElement {
  const wrapperRef = React.useRef<HTMLSpanElement | null>(null)
  // Pin callback in ref so re-renders don't churn the listener.
  const onOutsideRef = React.useRef(onOutside)
  onOutsideRef.current = onOutside

  React.useEffect(() => {
    if (disabled) return
    const handler = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      const wrapper = wrapperRef.current
      // wrapper is display:contents, so itself doesn't contain anything;
      // walk via Element.contains on the first interactive ancestor.
      // Easiest: check against the bounding tree by re-querying children.
      if (wrapper) {
        let node: Node | null = target
        while (node) {
          if (node === wrapper) return
          // Check if `node` is one of the wrapper's *rendered* children. We
          // approximate by checking parent chain against wrapper.
          if ((node as HTMLElement).parentNode === wrapper) return
          node = node.parentNode
        }
      }
      // Also "ignore" listed refs.
      for (const ref of ignore) {
        const el = ref.current
        if (el && el.contains(target)) return
      }
      onOutsideRef.current(event)
    }
    document.addEventListener('pointerdown', handler)
    return () => {
      document.removeEventListener('pointerdown', handler)
    }
  }, [disabled, ignore])

  return (
    <span ref={wrapperRef} data-iris-click-outside="" style={{ display: 'contents' }}>
      {children}
    </span>
  )
}
