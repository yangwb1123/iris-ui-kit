import * as React from 'react'
import {
  autoUpdate,
  computePosition,
  flip as flipMiddleware,
  offset as offsetMiddleware,
  shift as shiftMiddleware,
  size as sizeMiddleware,
  type Middleware,
  type Placement,
  type Strategy,
} from '@floating-ui/dom'

export interface UseFloatingOptions {
  /** Element the floating panel is positioned relative to. */
  anchor: React.RefObject<HTMLElement | null>
  /** The floating element itself. */
  floating: React.RefObject<HTMLElement | null>
  /** Whether the floating element is visible. Controls `autoUpdate` lifecycle. */
  open: boolean
  /** Default placement. Floating UI may flip it if `flip` is true. */
  placement?: Placement
  /** CSS position strategy. */
  strategy?: Strategy
  /** Pixel offset between anchor and floating element. */
  offset?: number
  /** Flip to the opposite side when the requested side overflows. Default `true`. */
  flip?: boolean
  /** Shift along the cross-axis to stay in view. Default `true`. */
  shift?: boolean
  /**
   * Constrain the floating element to the available viewport space — sets
   * `maxWidth`/`maxHeight` (minus 8px padding) on it so a long dropdown/popover
   * never overflows the screen (pair with `overflow:auto` for scroll). Off by
   * default. Pass a number to override the viewport padding.
   */
  size?: boolean | number
  /** Extra Floating UI middleware to append. */
  middleware?: Middleware[]
}

export interface UseFloatingReturn {
  x: number
  y: number
  strategy: Strategy
  finalPlacement: Placement
  /** Ready-to-bind inline style object for the floating element. */
  floatingStyles: React.CSSProperties
  /** Trigger a manual recompute. Usually not needed — `autoUpdate` handles scroll/resize. */
  update: () => Promise<void>
}

/**
 * Reactive Floating UI integration for React. Subscribes `autoUpdate`
 * whenever `open === true` and both refs are populated; tears it down on
 * close, unmount, or ref clearing.
 *
 * Pure positioning — does NOT render anything, does NOT manage focus,
 * does NOT handle dismiss behavior. Those concerns live in the consuming
 * primitive (Popover, Tooltip, Dialog, Menu, …).
 */
export function useFloating(options: UseFloatingOptions): UseFloatingReturn {
  const {
    anchor,
    floating,
    open,
    placement = 'bottom',
    strategy = 'absolute',
    offset,
    flip = true,
    shift = true,
    size = false,
    middleware: extraMiddleware,
  } = options

  const [x, setX] = React.useState(0)
  const [y, setY] = React.useState(0)
  const [finalPlacement, setFinalPlacement] = React.useState<Placement>(placement)

  const middleware = React.useMemo<Middleware[]>(() => {
    const mw: Middleware[] = []
    if (offset !== undefined) mw.push(offsetMiddleware(offset))
    if (flip) mw.push(flipMiddleware())
    if (shift) mw.push(shiftMiddleware({ padding: 8 }))
    if (size) {
      const padding = typeof size === 'number' ? size : 8
      mw.push(
        sizeMiddleware({
          padding,
          apply({ availableWidth, availableHeight, elements }) {
            Object.assign(elements.floating.style, {
              maxWidth: `${Math.max(0, Math.floor(availableWidth))}px`,
              maxHeight: `${Math.max(0, Math.floor(availableHeight))}px`,
            })
          },
        }),
      )
    }
    if (extraMiddleware) mw.push(...extraMiddleware)
    return mw
  }, [offset, flip, shift, size, extraMiddleware])

  // Hold the latest middleware in a ref so `update` always sees current value
  // without being re-created (which would churn the autoUpdate subscription).
  const middlewareRef = React.useRef(middleware)
  middlewareRef.current = middleware

  // Monotonic token bumped on every new positioning cycle and on teardown.
  // `computePosition` is async; without this guard a result that resolves
  // after the panel closed/unmounted (or after a newer update started) would
  // apply stale coordinates and call setState on an unmounted component.
  const epochRef = React.useRef(0)

  const update = React.useCallback(async () => {
    const a = anchor.current
    const f = floating.current
    if (!a || !f) return
    const token = ++epochRef.current
    const result = await computePosition(a, f, {
      placement,
      strategy,
      middleware: middlewareRef.current,
    })
    // A newer update() started, or the effect tore down, while awaiting — drop.
    if (token !== epochRef.current) return
    setX(result.x)
    setY(result.y)
    setFinalPlacement(result.placement)
  }, [anchor, floating, placement, strategy])

  React.useEffect(() => {
    if (!open) return
    const a = anchor.current
    const f = floating.current
    if (!a || !f) return
    const cleanup = autoUpdate(a, f, () => {
      void update()
    })
    return () => {
      // Invalidate any in-flight update() so its late result never lands.
      epochRef.current++
      cleanup()
    }
  }, [open, anchor, floating, update])

  const floatingStyles = React.useMemo<React.CSSProperties>(
    () => ({
      position: strategy,
      top: 0,
      left: 0,
      transform: `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`,
      width: 'max-content',
    }),
    [strategy, x, y],
  )

  return { x, y, strategy, finalPlacement, floatingStyles, update }
}
