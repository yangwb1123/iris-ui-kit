import { createEffect, onCleanup, type JSX } from 'solid-js'

export interface IrisClickOutsideProps {
  onOutside?: (event: PointerEvent) => void
  disabled?: boolean
  children?: JSX.Element
}

/**
 * Behavior wrapper: fires `onOutside` when a `pointerdown` happens outside
 * the wrapped child tree. Wraps children in a `<span style="display:contents">`.
 * Solid port of the Vue IrisClickOutside.
 */
export function IrisClickOutside(props: IrisClickOutsideProps): JSX.Element {
  let wrapperRef: HTMLSpanElement | undefined

  createEffect(() => {
    if (props.disabled) return
    if (typeof document === 'undefined') return

    const handler = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target || !wrapperRef) return
      if (wrapperRef.contains(target)) return
      props.onOutside?.(event)
    }

    document.addEventListener('pointerdown', handler)
    onCleanup(() => document.removeEventListener('pointerdown', handler))
  })

  return (
    <span
      ref={(el) => {
        wrapperRef = el
      }}
      data-iris-click-outside=""
      style={{ display: 'contents' }}
    >
      {props.children}
    </span>
  )
}
