import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { findNavPath, isBranch, type NavNode } from '@iris-ui-kit/core'

/**
 * Flyout interaction controller for IrisNavMenu (horizontal + collapsed
 * rail): hover open/close latencies, click pinning, pointer containment,
 * viewport pinning, and the keyboard-focus visibility model. Aligned with
 * ant-design-vue Menu menubar semantics (A2/A3/A6/A9/A10).
 */
export interface NavMenuFlyoutCtx {
  items: NavNode[]
  tree: { value: NavNode[] }
  expanded: { value: string[] }
  flyoutMode: { value: boolean }
  collapsed: boolean
  toggle: (key: string) => void
  emitSelect: (key: string, node: NavNode) => void
}

// Hover 打开延迟 40ms：低于人眼可感知的 66ms，提升"hover 即开"的跟手
// 感（用户反馈 hover 不显示子菜单的感知问题主要来自延迟+边缘抖动）。
const HOVER_OPEN_DELAY_VAL = 40
const HOVER_CLOSE_DELAY_VAL = 150

export function createNavMenuFlyout(ctx: NavMenuFlyoutCtx) {
  const hovered = ref<string | null>(null)
  const hoveredBranches = ref<string[]>([])
  const focusedBranches = ref<string[]>([])
  /** Branches pinned open by a click (horizontal mode) — sticky across hover. */
  const clickedBranches = ref<string[]>([])
  /** Set while Escape is returning focus to a trigger: the group focusin
   * handler must not re-open the flyout it just closed. */
  let suppressFocusOpen = false

  // Hover open/close latencies: a single open timer plus per-branch close
  // timers so fast pointer travel across branches never flickers a popup.
  let openTimer: ReturnType<typeof setTimeout> | null = null
  const closeTimers = new Map<string, ReturnType<typeof setTimeout>>()

  const clearOpenTimer = (): void => {
    if (openTimer) {
      clearTimeout(openTimer)
      openTimer = null
    }
  }
  const cancelClose = (key: string): void => {
    const timer = closeTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      closeTimers.delete(key)
    }
  }
  const cancelAllTimers = (): void => {
    clearOpenTimer()
    for (const timer of closeTimers.values()) clearTimeout(timer)
    closeTimers.clear()
  }
  onBeforeUnmount(cancelAllTimers)

  // --- Flyout viewport pinning ----------------------------------------
  // Top-level flyout popups (horizontal + collapsed rail) are rendered
  // in-flow, but the admin shell hosts the rail inside scroll containers
  // (sidebar overflow) — plain `position: absolute` popups get clipped.
  // Pin each top-level popup to the viewport with `position: fixed` from
  // the trigger's rect and keep it glued while open via scroll/resize
  // listeners. Nested popups stay absolute: their containing block is the
  // already-pinned top-level popup.
  const flyoutTriggers = new Map<string, HTMLElement>()
  const flyoutPanels = new Map<string, HTMLElement>()

  const setFlyoutRef = (map: Map<string, HTMLElement>, key: string, el: unknown): void => {
    if (el instanceof HTMLElement) map.set(key, el)
    else map.delete(key)
  }

  const positionFlyout = (key: string): void => {
    const trigger = flyoutTriggers.get(key)
    const panel = flyoutPanels.get(key)
    if (!trigger || !panel || typeof document === 'undefined') return
    const rect = trigger.getBoundingClientRect()
    const dir = getComputedStyle(trigger).direction
    panel.style.position = 'fixed'
    panel.style.top = `${ctx.collapsed ? rect.top : rect.bottom}px`
    if (dir === 'rtl') {
      // Rail: popup opens on the inline-start side (left in RTL).
      panel.style.left = ''
      panel.style.right = `${window.innerWidth - (ctx.collapsed ? rect.left : rect.right)}px`
    } else {
      panel.style.right = ''
      panel.style.left = `${ctx.collapsed ? rect.right : rect.left}px`
    }
  }

  onBeforeUnmount(() => {
    detachViewportListeners()
    flyoutTriggers.clear()
    flyoutPanels.clear()
  })

  /** Menubar semantics: at most one flyout per depth. Opening (hover / click
   * / keyboard) a branch closes any other branch's popup at the same depth,
   * so a pinned popup never coexists with a sibling hover popup and clicking
   * a sibling branch visibly switches the open popup. */
  const isolateAtDepth = (key: string): void => {
    const depth = findNavPath(ctx.items, key).length - 1
    const isSameDepthOther = (k: string): boolean =>
      k !== key && findNavPath(ctx.items, k).length - 1 === depth
    for (const state of [hoveredBranches, clickedBranches, focusedBranches]) {
      if (state.value.some(isSameDepthOther)) {
        state.value = state.value.filter((k) => !isSameDepthOther(k))
      }
    }
  }

  const scheduleOpen = (key: string): void => {
    clearOpenTimer()
    openTimer = setTimeout(() => {
      openTimer = null
      isolateAtDepth(key)
      setBranchInteraction(hoveredBranches, key, true)
    }, HOVER_OPEN_DELAY_VAL)
  }
  const scheduleClose = (key: string): void => {
    cancelClose(key)
    closeTimers.set(
      key,
      setTimeout(() => {
        closeTimers.delete(key)
        setBranchInteraction(hoveredBranches, key, false)
      }, HOVER_CLOSE_DELAY_VAL),
    )
  }

  const closeHorizontalMenus = (): void => {
    if (!ctx.flyoutMode.value) return
    cancelAllTimers()
    hovered.value = null
    hoveredBranches.value = []
    focusedBranches.value = []
    clickedBranches.value = []
  }

  const select = (node: NavNode): void => {
    if (node.disabled) return
    closeHorizontalMenus()
    ctx.emitSelect(node.key, node)
  }

  /** Horizontal branch click: toggle the flyout without touching expandedKeys. */
  const toggleFlyout = (key: string): void => {
    cancelAllTimers()
    const current = clickedBranches.value
    if (current.includes(key)) {
      clickedBranches.value = current.filter((k) => k !== key)
      setBranchInteraction(hoveredBranches, key, false)
      setBranchInteraction(focusedBranches, key, false)
    } else {
      // Clicking a sibling branch switches the pinned popup (antd behavior).
      isolateAtDepth(key)
      clickedBranches.value = [...clickedBranches.value, key]
    }
  }

  /** Keyboard open: mark the branch as focused (instant, menubar pattern). */
  const openFlyout = (key: string): void => {
    cancelAllTimers()
    isolateAtDepth(key)
    setBranchInteraction(focusedBranches, key, true)
  }

  const setBranchInteraction = (
    state: typeof hoveredBranches,
    key: string,
    enabled: boolean,
  ): void => {
    const current = state.value
    if (enabled) {
      if (!current.includes(key)) state.value = [...current, key]
    } else if (current.includes(key)) {
      state.value = current.filter((item) => item !== key)
    }
  }

  const keepsPointerInside = (
    container: EventTarget | null,
    event: { relatedTarget?: EventTarget | null },
  ): boolean => {
    if (!container || !(container instanceof HTMLElement)) return false
    const next = event.relatedTarget
    return !!(next && next instanceof Node && container.contains(next))
  }

  const interactionKeyAtDepth = (keys: string[], depth: number): string | undefined =>
    keys.find((key) => findNavPath(ctx.items, key).length === depth + 1)

  const horizontalBranchVisible = (key: string, depth: number): boolean => {
    const hoveredAtDepth = interactionKeyAtDepth(hoveredBranches.value, depth)
    if (hoveredAtDepth) return hoveredAtDepth === key
    const clickedAtDepth = interactionKeyAtDepth(clickedBranches.value, depth)
    if (clickedAtDepth) return clickedAtDepth === key
    return interactionKeyAtDepth(focusedBranches.value, depth) === key
  }

  // Watch the set of currently-visible top-level flyouts: pin each to the
  // viewport as it opens and keep them glued via scroll/resize listeners.
  const shownFlyoutKeys = computed(() => {
    if (!ctx.flyoutMode.value) return []
    const keys: string[] = []
    for (const node of ctx.tree.value) {
      if (isBranch(node) && horizontalBranchVisible(node.key, 0)) keys.push(node.key)
    }
    return keys
  })

  const repositionOpenFlyouts = (): void => {
    for (const key of shownFlyoutKeys.value) positionFlyout(key)
  }

  let viewportListenersActive = false
  const attachViewportListeners = (): void => {
    if (viewportListenersActive || typeof document === 'undefined') return
    viewportListenersActive = true
    // Capture phase: sidebar/header scroll containers don't bubble scroll.
    document.addEventListener('scroll', repositionOpenFlyouts, true)
    window.addEventListener('resize', repositionOpenFlyouts)
  }
  const detachViewportListeners = (): void => {
    if (!viewportListenersActive || typeof document === 'undefined') return
    viewportListenersActive = false
    document.removeEventListener('scroll', repositionOpenFlyouts, true)
    window.removeEventListener('resize', repositionOpenFlyouts)
  }

  watch(
    shownFlyoutKeys,
    (keys, prev) => {
      if (keys.length > 0 && prev.length === 0) attachViewportListeners()
      else if (keys.length === 0 && prev.length > 0) detachViewportListeners()
      for (const key of keys) positionFlyout(key)
    },
    { flush: 'post' },
  )

  return {
    hovered,
    hoveredBranches,
    focusedBranches,
    clickedBranches,
    select,
    toggleFlyout,
    openFlyout,
    closeHorizontalMenus,
    setBranchInteraction,
    keepsPointerInside,
    interactionKeyAtDepth,
    horizontalBranchVisible,
    shownFlyoutKeys,
    setFlyoutRef,
    flyoutTriggers,
    flyoutPanels,
    suppressFocusOpen: { get: () => suppressFocusOpen },
    setSuppressFocusOpen: (value: boolean) => {
      suppressFocusOpen = value
    },
    cancelClose,
    scheduleOpen,
    scheduleClose,
    cancelAllTimers,
  }
}
