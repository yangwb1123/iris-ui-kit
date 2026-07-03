/**
 * Behavior wrapper: detects a press-and-hold gesture on the wrapped element.
 * Fires `onLongPress` when the pointer is held down for `holdDelay` ms.
 * Wraps children in a `display: contents` span so event bubbling works.
 *
 * Composable: stack with `IrisMovable` / `IrisResizable` / `IrisSortable` /
 * `IrisHotkey` for richer interactions.
 *
 * @example
 *   <IrisLongPress holdDelay={500} onLongPress={() => setOpen(true)}>
 *     <img src="thumbnail.jpg" alt="Hold to preview" />
 *   </IrisLongPress>
 */
import * as React from 'react'
import { createLongPress } from '@iris-ui/core'

export interface IrisLongPressProps {
  /** Time in ms the pointer must be held before `onLongPress` fires. */
  holdDelay?: number
  /** Called once when the hold reaches `holdDelay`. */
  onLongPress: () => void
  disabled?: boolean
  children?: React.ReactNode
}

export function IrisLongPress({
  holdDelay = 500,
  onLongPress,
  disabled = false,
  children,
}: IrisLongPressProps): React.ReactElement {
  const handlerRef = React.useRef(onLongPress)
  handlerRef.current = onLongPress

  const ctrl = React.useMemo(
    () =>
      createLongPress({
        holdDelay,
        onLongPress: () => handlerRef.current(),
      }),
    [holdDelay],
  )

  const onPointerDown_ = (_e: React.PointerEvent) => {
    if (disabled) return
    ctrl.press()
  }

  const onPointerUp_ = () => {
    ctrl.release()
  }

  const onPointerLeave_ = () => {
    ctrl.cancel()
  }

  return (
    <span
      data-iris-long-press=""
      onPointerDown={onPointerDown_}
      onPointerUp={onPointerUp_}
      onPointerLeave={onPointerLeave_}
      style={{ display: 'contents' }}
    >
      {children}
    </span>
  )
}
