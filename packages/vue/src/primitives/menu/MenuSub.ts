import {
  Teleport,
  computed,
  defineComponent,
  h,
  inject,
  nextTick,
  onScopeDispose,
  provide,
  ref,
  watch,
  type PropType,
} from 'vue'
import { useFloating } from '../floating/useFloating'
import { MenuContextKey } from './context'

const HOVER_OPEN_DELAY = 100
const HOVER_CLOSE_DELAY = 150

/**
 * Nested submenu. Renders its own trigger (as a `[role="menuitem"]` inside
 * the parent menu) and its own floating content panel. Opens on hover (with
 * a small delay to avoid accidental triggers when the pointer flies past)
 * and on `ArrowRight` / `Enter`; closes on `ArrowLeft` (restoring focus to
 * its own trigger).
 *
 * Inherits `closeRoot` from the surrounding `IrisMenu` so picking a leaf
 * collapses the whole tree.
 *
 * @example
 *   <IrisMenuContent>
 *     <IrisMenuItem @select="copy">Copy</IrisMenuItem>
 *     <IrisMenuSub label="More…">
 *       <IrisMenuItem @select="paste">Paste</IrisMenuItem>
 *       <IrisMenuItem @select="pasteSpecial">Paste special…</IrisMenuItem>
 *     </IrisMenuSub>
 *   </IrisMenuContent>
 */
export const IrisMenuSub = defineComponent({
  name: 'IrisMenuSub',
  inheritAttrs: false,
  props: {
    label: { type: String, default: '' },
    teleport: {
      type: [String, Object, Boolean] as PropType<string | HTMLElement | false>,
      default: 'body',
    },
  },
  setup(props, { slots, attrs }) {
    const parentCtx = inject(MenuContextKey)
    if (!parentCtx) {
      throw new Error('[iris-ui] IrisMenuSub must be inside an IrisMenu')
    }

    const open = ref(false)
    const triggerRef = ref<HTMLElement | null>(null)
    const contentRef = ref<HTMLElement | null>(null)
    let openTimer: ReturnType<typeof setTimeout> | null = null
    let closeTimer: ReturnType<typeof setTimeout> | null = null
    // B3: only keyboard-opened submenus move focus (hover/click must not).
    let focusOnOpen = false
    let keyboardManaged = false

    const clearTimer = () => {
      if (openTimer) {
        clearTimeout(openTimer)
        openTimer = null
      }
    }
    const clearCloseTimer = () => {
      if (closeTimer) {
        clearTimeout(closeTimer)
        closeTimer = null
      }
    }

    const scheduleOpen = () => {
      clearTimer()
      clearCloseTimer()
      openTimer = setTimeout(() => {
        open.value = true
        openTimer = null
      }, HOVER_OPEN_DELAY)
    }

    const scheduleClose = () => {
      clearTimer()
      clearCloseTimer()
      closeTimer = setTimeout(() => {
        closeTimer = null
        // Pointer-driven close: keyboard focus management is done.
        keyboardManaged = false
        open.value = false
      }, HOVER_CLOSE_DELAY)
    }

    onScopeDispose(() => {
      clearTimer()
      clearCloseTimer()
    })

    const { floatingStyles } = useFloating({
      anchor: triggerRef,
      floating: contentRef,
      open,
      placement: 'right-start',
      offset: -4,
    })

    // Provide a nested context to descendants so deeper `IrisMenuSub` /
    // `IrisMenuItem` work transparently. `closeRoot` continues to point at
    // the *root* menu, so any leaf still closes the entire tree.
    provide(MenuContextKey, {
      open: computed(() => open.value),
      setOpen: (v) => (open.value = v),
      triggerRef,
      contentRef,
      contentId: '',
      treeId: parentCtx.treeId,
      placement: 'right-start',
      offset: 0,
      closeRoot: parentCtx.closeRoot,
    })

    const onTriggerPointerEnter = () => scheduleOpen()
    // B2: leaving the trigger (or the content) closes the submenu after a
    // short grace period — moving from trigger into content cancels it.
    const onTriggerPointerLeave = () => scheduleClose()
    const onTriggerClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      clearTimer()
      clearCloseTimer()
      keyboardManaged = false
      open.value = !open.value
    }
    const onTriggerKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'ArrowRight' ||
        event.key === 'ArrowDown' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        // B4: ArrowDown opens the submenu like ArrowRight; stopPropagation
        // keeps the root content from treating it as root-level navigation.
        event.preventDefault()
        event.stopPropagation()
        focusOnOpen = true
        keyboardManaged = true
        if (open.value) {
          // Already open (e.g. hover-opened): the open-watcher won't re-fire
          // (value unchanged) — move focus into the content right away and
          // consume the flag so a later pointer open can't steal focus (B3).
          focusOnOpen = false
          focusFirstItem()
        } else {
          open.value = true
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        event.stopPropagation()
        open.value = false
      }
    }

    /** Keyboard-opened submenus move focus to the first item (B3: pointer
     * opens must not steal focus). */
    const focusFirstItem = (): void => {
      void nextTick(() => {
        contentRef.value?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
      })
    }

    watch(open, (next) => {
      if (next) {
        // B3: hover/click opens must not steal focus from the pointer path.
        if (!focusOnOpen) return
        focusOnOpen = false
        focusFirstItem()
      } else if (keyboardManaged) {
        // Return focus to this submenu's trigger only when keyboard-managed.
        keyboardManaged = false
        triggerRef.value?.focus?.()
      }
    })

    const onContentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const items = Array.from(
          contentRef.value?.querySelectorAll<HTMLElement>(
            '[role="menuitem"]:not([aria-disabled="true"])',
          ) ?? [],
        )
        if (items.length === 0) return
        const index = items.indexOf(document.activeElement as HTMLElement)
        const next =
          event.key === 'ArrowDown'
            ? index < 0
              ? 0
              : (index + 1) % items.length
            : index <= 0
              ? items.length - 1
              : index - 1
        items[next]?.focus()
      } else if (event.key === 'ArrowLeft' || event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        open.value = false
      } else if (event.key === 'Tab') {
        parentCtx.closeRoot()
      }
    }

    return () => {
      const trigger = h(
        'div',
        {
          ref: (el: unknown) => {
            triggerRef.value = (el ?? null) as HTMLElement | null
          },
          role: 'menuitem',
          'aria-haspopup': 'menu',
          'aria-expanded': open.value ? 'true' : 'false',
          tabindex: 0,
          'data-iris-menu-sub-trigger': '',
          'data-state': open.value ? 'open' : 'closed',
          onPointerenter: onTriggerPointerEnter,
          onPointerleave: onTriggerPointerLeave,
          onClick: onTriggerClick,
          onKeydown: onTriggerKeyDown,
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--iris-gap-sm)',
            padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md)',
            borderRadius: 'var(--iris-radius-sm)',
            cursor: 'pointer',
            outline: 'none',
            fontSize: 'var(--iris-font-size-md, 14px)',
            background: open.value ? 'var(--iris-surface-hover)' : 'transparent',
          },
        },
        [
          h('span', null, props.label || slots.label?.()),
          h('svg', { 'aria-hidden': 'true', viewBox: '0 0 16 16', width: '12', height: '12' }, [
            h('path', {
              d: 'M6 4l4 4-4 4',
              fill: 'none',
              stroke: 'currentColor',
              'stroke-width': '1.5',
              'stroke-linecap': 'round',
              'stroke-linejoin': 'round',
            }),
          ]),
        ],
      )

      const content = open.value
        ? h(
            'div',
            {
              ...attrs,
              ref: (el: unknown) => {
                contentRef.value = (el ?? null) as HTMLElement | null
              },
              role: 'menu',
              tabindex: -1,
              'data-iris-menu-sub': '',
              // B1: tag the surface with the root menu's tree id so the root
              // dismiss ignores pointerdown inside teleported submenus.
              'data-iris-menu-tree': parentCtx.treeId,
              'data-state': 'open',
              onKeydown: onContentKeyDown,
              onPointerenter: () => {
                clearTimer()
                clearCloseTimer()
              },
              onPointerleave: scheduleClose,
              style: {
                ...floatingStyles.value,
                background: 'var(--iris-surface-floating)',
                color: 'var(--iris-foreground)',
                border: '1px solid var(--iris-border)',
                borderRadius: 'var(--iris-radius-md)',
                padding: 'var(--iris-padding-sm)',
                boxShadow: 'var(--iris-shadow-lg)',
                minWidth: '180px',
                outline: 'none',
                zIndex: '1001',
              },
            },
            slots.default?.(),
          )
        : null

      const portal =
        content && props.teleport !== false
          ? h(Teleport, { to: props.teleport as string | HTMLElement }, [content])
          : content

      return [trigger, portal]
    }
  },
})
