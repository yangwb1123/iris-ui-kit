import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue'
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
  anchor: Ref<HTMLElement | null | undefined>
  /** The floating element itself. */
  floating: Ref<HTMLElement | null | undefined>
  /** Whether the floating element is visible. Controls `autoUpdate` lifecycle. */
  open: Ref<boolean>
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
  /** Extra Floating UI middleware to append. */
  middleware?: Middleware[]
}

export interface UseFloatingReturn {
  /** Computed x coordinate (px). */
  x: Ref<number>
  /** Computed y coordinate (px). */
  y: Ref<number>
  /** Final strategy (echo of input). */
  strategy: Ref<Strategy>
  /** Final placement, possibly flipped from the input placement. */
  finalPlacement: Ref<Placement>
  /** Ready-to-bind inline style object for the floating element. */
  floatingStyles: ComputedRef<Record<string, string>>
  /** Trigger a manual recompute. Usually not needed — `autoUpdate` handles scrolling/resizing. */
  update: () => Promise<void>
}

/**
 * Reactive Floating UI integration. Subscribes `autoUpdate` whenever
 * `open === true` and both refs are populated; tears it down on close,
 * unmount, or ref clearing. Returns `floatingStyles` ready to be spread onto
 * the floating element.
 *
 * Pure positioning — does NOT render anything, does NOT manage focus,
 * does NOT handle dismiss behavior. Those concerns live in the consuming
 * primitive (Popover, Tooltip, Dialog, Menu, ...).
 *
 * @example
 *   const triggerEl = ref<HTMLElement | null>(null)
 *   const contentEl = ref<HTMLElement | null>(null)
 *   const open = ref(false)
 *   const { floatingStyles } = useFloating({
 *     anchor: triggerEl,
 *     floating: contentEl,
 *     open,
 *     placement: 'bottom-start',
 *     offset: 8,
 *   })
 */
export function useFloating(options: UseFloatingOptions): UseFloatingReturn {
  const x = ref(0)
  const y = ref(0)
  const strategy = ref<Strategy>(options.strategy ?? 'absolute')
  const finalPlacement = ref<Placement>(options.placement ?? 'bottom')

  const middleware = shallowRef<Middleware[]>([])
  rebuildMiddleware()

  function rebuildMiddleware() {
    const mw: Middleware[] = []
    if (options.offset !== undefined) mw.push(offsetMiddleware(options.offset))
    if (options.flip !== false) mw.push(flipMiddleware())
    if (options.shift !== false) mw.push(shiftMiddleware({ padding: 8 }))
    if (options.middleware) mw.push(...options.middleware)
    middleware.value = mw
  }

  let cleanupAutoUpdate: (() => void) | null = null

  async function update() {
    const a = options.anchor.value
    const f = options.floating.value
    if (!a || !f) return
    const result = await computePosition(a, f, {
      placement: options.placement ?? 'bottom',
      strategy: strategy.value,
      middleware: middleware.value,
    })
    x.value = result.x
    y.value = result.y
    finalPlacement.value = result.placement
  }

  watch(
    [options.open, options.anchor, options.floating],
    ([isOpen, anchorEl, floatingEl]) => {
      cleanupAutoUpdate?.()
      cleanupAutoUpdate = null
      if (isOpen && anchorEl && floatingEl) {
        cleanupAutoUpdate = autoUpdate(anchorEl, floatingEl, () => {
          void update()
        })
      }
    },
    { flush: 'post', immediate: true },
  )

  onScopeDispose(() => {
    cleanupAutoUpdate?.()
    cleanupAutoUpdate = null
  })

  const floatingStyles = computed<Record<string, string>>(() => ({
    position: strategy.value,
    top: '0',
    left: '0',
    transform: `translate3d(${Math.round(x.value)}px, ${Math.round(y.value)}px, 0)`,
    width: 'max-content',
  }))

  return { x, y, strategy, finalPlacement, floatingStyles, update }
}
