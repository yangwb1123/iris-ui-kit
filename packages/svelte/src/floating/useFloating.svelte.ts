import {
  autoUpdate,
  computePosition,
  arrow as arrowMiddleware,
  flip as flipMiddleware,
  offset as offsetMiddleware,
  shift as shiftMiddleware,
  size as sizeMiddleware,
  type Middleware,
  type Placement,
  type Strategy,
} from '@floating-ui/dom'

type ReactiveOption<T> = T | (() => T | undefined)

const readOption = <T>(option: ReactiveOption<T> | undefined): T | undefined =>
  typeof option === 'function' ? (option as () => T)() : option

export interface UseFloatingOptions {
  /** Element the floating panel is positioned relative to. */
  anchor: () => HTMLElement | undefined | null
  /** The floating element itself. */
  floating: () => HTMLElement | undefined | null
  /** Whether the floating element is visible. Controls the `autoUpdate` lifecycle. */
  open: () => boolean
  placement?: ReactiveOption<Placement>
  strategy?: ReactiveOption<Strategy>
  offset?: ReactiveOption<number>
  flip?: ReactiveOption<boolean>
  shift?: ReactiveOption<boolean>
  /**
   * Constrain the floating element to the available viewport space — sets
   * `maxWidth`/`maxHeight` (minus 8px padding) on it so a long dropdown/popover
   * never overflows the screen (pair with `overflow:auto` for scroll). Off by
   * default. Pass a number to override the viewport padding.
   */
  size?: ReactiveOption<boolean | number>
  middleware?: ReactiveOption<Middleware[]>
  /**
   * Optional getter returning the arrow element inside the floating panel.
   * When provided, `arrowX`, `arrowY`, `arrowSide` in the return are populated.
   */
  arrow?: () => HTMLElement | null | undefined
}

export interface UseFloatingReturn {
  /** Resolved placement after flip/shift. */
  readonly finalPlacement: Placement
  /** Ready-to-bind inline style STRING for the floating element. */
  readonly floatingStyles: string
  readonly arrowX: number | undefined
  readonly arrowY: number | undefined
  /** Side of the floating element the arrow is on ('bottom' placement → 'top'). */
  readonly arrowSide: 'top' | 'right' | 'bottom' | 'left' | undefined
}

/**
 * Reactive Floating UI integration for Svelte 5 (a `.svelte.ts` runes module).
 * Subscribes `autoUpdate` while `open()` is true and both elements exist; tears
 * it down on close / unmount via the `$effect` teardown. Pure positioning — no
 * rendering, focus, or dismiss behavior. Svelte port of the React/Vue/Solid
 * `useFloating`.
 */
export function useFloating(options: UseFloatingOptions): UseFloatingReturn {
  let x = $state(0)
  let y = $state(0)
  let finalPlacement = $state<Placement>('bottom')
  let arrowX = $state<number | undefined>(undefined)
  let arrowY = $state<number | undefined>(undefined)

  const buildMiddleware = (): Middleware[] => {
    const mw: Middleware[] = []
    const offset = readOption(options.offset)
    const flip = readOption(options.flip)
    const shift = readOption(options.shift)
    const size = readOption(options.size)
    const middleware = readOption(options.middleware)
    if (offset !== undefined) mw.push(offsetMiddleware(offset))
    if (flip !== false) mw.push(flipMiddleware())
    if (shift !== false) mw.push(shiftMiddleware({ padding: 8 }))
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
    const arrowEl = options.arrow?.()
    if (arrowEl) mw.push(arrowMiddleware({ element: arrowEl }))
    if (middleware) mw.push(...middleware)
    return mw
  }

  // Monotonic token bumped on each new positioning cycle and on teardown, so a
  // computePosition() that resolves after this effect tore down (close/unmount
  // or a newer cycle) drops its result instead of applying stale coordinates.
  let epoch = 0

  const OPPOSITE: Record<string, 'top' | 'right' | 'bottom' | 'left'> = {
    top: 'bottom',
    bottom: 'top',
    left: 'right',
    right: 'left',
  }
  const arrowSide = $derived(
    OPPOSITE[finalPlacement.split('-')[0]] as 'top' | 'right' | 'bottom' | 'left' | undefined,
  )

  $effect(() => {
    if (!options.open()) return
    const a = options.anchor()
    const f = options.floating()
    if (!a || !f) return
    const placement = readOption(options.placement) ?? 'bottom'
    const strategy = readOption(options.strategy) ?? 'absolute'
    // Build while the effect is collecting dependencies so getter-backed
    // options (placement/offset/size/middleware) restart positioning when they
    // change. The resulting middleware is stable for this autoUpdate cycle.
    const middleware = buildMiddleware()
    const update = (): void => {
      const token = ++epoch
      void computePosition(a, f, {
        placement,
        strategy,
        middleware,
      }).then((result) => {
        if (token !== epoch) return
        x = result.x
        y = result.y
        finalPlacement = result.placement
        const arrowData = result.middlewareData.arrow as { x?: number; y?: number } | undefined
        arrowX = arrowData?.x
        arrowY = arrowData?.y
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
      const strategy = readOption(options.strategy) ?? 'absolute'
      return `position: ${strategy}; top: 0; left: 0; transform: translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0); width: max-content`
    },
    get arrowX() {
      return arrowX
    },
    get arrowY() {
      return arrowY
    },
    get arrowSide() {
      return arrowSide
    },
  }
}
