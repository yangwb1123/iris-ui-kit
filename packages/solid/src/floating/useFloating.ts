import { createEffect, createSignal, onCleanup, type Accessor } from 'solid-js'
import {
  autoUpdate,
  computePosition,
  flip as flipMiddleware,
  offset as offsetMiddleware,
  shift as shiftMiddleware,
  type Middleware,
  type Placement,
  type Strategy,
} from '@floating-ui/dom'
import type { JSX } from 'solid-js'

export interface UseFloatingOptions {
  /** Element the floating panel is positioned relative to. */
  anchor: Accessor<HTMLElement | undefined | null>
  /** The floating element itself. */
  floating: Accessor<HTMLElement | undefined | null>
  /** Whether the floating element is visible. Controls the `autoUpdate` lifecycle. */
  open: Accessor<boolean>
  placement?: Placement
  strategy?: Strategy
  offset?: number
  flip?: boolean
  shift?: boolean
  middleware?: Middleware[]
}

export interface UseFloatingReturn {
  finalPlacement: Accessor<Placement>
  /** Ready-to-bind inline style accessor for the floating element. */
  floatingStyles: Accessor<JSX.CSSProperties>
}

/**
 * Reactive Floating UI integration for Solid. Subscribes `autoUpdate` while
 * `open()` is true and both elements exist; tears it down on close / unmount.
 * Pure positioning — no rendering, focus, or dismiss behavior (those live in
 * the consuming primitive). Solid port of the React/Vue `useFloating`.
 */
export function useFloating(options: UseFloatingOptions): UseFloatingReturn {
  const placement = (): Placement => options.placement ?? 'bottom'
  const strategy = (): Strategy => options.strategy ?? 'absolute'

  const [x, setX] = createSignal(0)
  const [y, setY] = createSignal(0)
  const [finalPlacement, setFinalPlacement] = createSignal<Placement>(placement())

  const buildMiddleware = (): Middleware[] => {
    const mw: Middleware[] = []
    if (options.offset !== undefined) mw.push(offsetMiddleware(options.offset))
    if (options.flip !== false) mw.push(flipMiddleware())
    if (options.shift !== false) mw.push(shiftMiddleware({ padding: 8 }))
    if (options.middleware) mw.push(...options.middleware)
    return mw
  }

  createEffect(() => {
    if (!options.open()) return
    const a = options.anchor()
    const f = options.floating()
    if (!a || !f) return
    const update = (): void => {
      void computePosition(a, f, {
        placement: placement(),
        strategy: strategy(),
        middleware: buildMiddleware(),
      }).then((result) => {
        setX(result.x)
        setY(result.y)
        setFinalPlacement(result.placement)
      })
    }
    const cleanup = autoUpdate(a, f, update)
    onCleanup(cleanup)
  })

  const floatingStyles = (): JSX.CSSProperties => ({
    position: strategy(),
    top: '0',
    left: '0',
    transform: `translate3d(${Math.round(x())}px, ${Math.round(y())}px, 0)`,
    width: 'max-content',
  })

  return { finalPlacement, floatingStyles }
}
