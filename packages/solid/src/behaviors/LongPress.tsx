import { mergeProps, splitProps, type JSX } from 'solid-js'
import { createLongPress } from '@iris-ui/core'

export interface IrisLongPressProps {
  /** Time the pointer must be held before `onLongPress` fires, in ms. Defaults to 500. */
  holdDelay?: number
  /** Called once when the hold reaches `holdDelay` without an intervening release. */
  onLongPress: () => void
  disabled?: boolean
  children?: JSX.Element
}

/**
 * IrisLongPress (Solid) — Behavior wrapper for press-and-hold gestures.
 * Wraps the framework-agnostic `createLongPress` from `@iris-ui/core`. Renders
 * a `<span data-iris-long-press>` with `display: contents` so it doesn't
 * affect layout.
 */
export function IrisLongPress(props: IrisLongPressProps): JSX.Element {
  const merged = mergeProps({ holdDelay: 500, disabled: false }, props)
  const [local] = splitProps(merged, ['holdDelay', 'onLongPress', 'disabled', 'children'])

  // Solid components only run their setup body once, so this mirrors the
  // React reference's `useMemo(..., [holdDelay])` — the controller is created
  // once for the component's lifetime. `onLongPress` is read from `local`
  // (a reactive getter) at fire-time rather than captured here, so a
  // changing callback identity is always honored without recreating the
  // controller.
  const ctrl = createLongPress({
    holdDelay: local.holdDelay,
    onLongPress: () => local.onLongPress(),
  })

  const onPointerDown = () => {
    if (local.disabled) return
    ctrl.press()
  }
  const onPointerUp = () => ctrl.release()
  const onPointerLeave = () => ctrl.cancel()

  return (
    <span
      data-iris-long-press=""
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      style={{ display: 'contents' }}
    >
      {local.children}
    </span>
  )
}
