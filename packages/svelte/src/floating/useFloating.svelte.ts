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

export interface UseFloatingOptions {
  /** Element the floating panel is positioned relative to. */
  anchor: () => HTMLElement | undefined | null
  /** The floating element itself. */
  floating: () => HTMLElement | undefined | null
  /** Whether the floating element is visible. Controls the `autoUpdate` lifecycle. */
  open: () => boolean
  placement?: Placement
  strategy?: Strategy
  offset?: number
  flip?: boolean
  shift?: boolean
  middleware?: Middleware[]
}

export interface UseFloatingReturn {
  /** Resolved placement after flip/shift. */
  readonly finalPlacement: Placement
  /** Ready-to-bind inline style STRING for the floating element. */
  readonly floatingStyles: string
}

/**
 * Reactive Floating UI integration for Svelte 5 (a `.svelte.ts` runes module).
 * Subscribes `autoUpdate` while `open()` is true and both elements exist; tears
 * it down on close / unmount via the `$effect` teardown. Pure positioning — no
 * rendering, focus, or dismiss behavior. Svelte port of the React/Vue/Solid
 * `useFloating`.
 */
export function useFloating(options: UseFloatingOptions): UseFloatingReturn {
  const placement = options.placement ?? 'bottom'
  const strategy = options.strategy ?? 'absolute'

  let x = $state(0)
  let y = $state(0)
  let finalPlacement = $state<Placement>(placement)

  const buildMiddleware = (): Middleware[] => {
    const mw: Middleware[] = []
    if (options.offset !== undefined) mw.push(offsetMiddleware(options.offset))
    if (options.flip !== false) mw.push(flipMiddleware())
    if (options.shift !== false) mw.push(shiftMiddleware({ padding: 8 }))
    if (options.middleware) mw.push(...options.middleware)
    return mw
  }

  // Monotonic token bumped on each new positioning cycle and on teardown, so a
  // computePosition() that resolves after this effect tore down (close/unmount
  // or a newer cycle) drops its result instead of applying stale coordinates.
  let epoch = 0

  $effect(() => {
    if (!options.open()) return
    const a = options.anchor()
    const f = options.floating()
    if (!a || !f) return
    const update = (): void => {
      const token = ++epoch
      void computePosition(a, f, {
        placement,
        strategy,
        middleware: buildMiddleware(),
      }).then((result) => {
        if (token !== epoch) return
        x = result.x
        y = result.y
        finalPlacement = result.placement
      })
    }
    const cleanup = autoUpdate(a, f, update)
    return () => {
      epoch++
      cleanup()
    }
  })

  return {
    get finalPlacement() {
      return finalPlacement
    },
    get floatingStyles() {
      return `position: ${strategy}; top: 0; left: 0; transform: translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0); width: max-content`
    },
  }
}
