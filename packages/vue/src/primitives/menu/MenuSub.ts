import {
  Teleport,
  computed,
  defineComponent,
  h,
  inject,
  onScopeDispose,
  provide,
  ref,
  watch,
  type PropType,
} from 'vue'
import { useFloating } from '../floating/useFloating'
import { MenuContextKey } from './context'

const HOVER_OPEN_DELAY = 100

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

    const clearTimer = () => {
      if (openTimer) {
        clearTimeout(openTimer)
        openTimer = null
      }
    }

    const scheduleOpen = () => {
      clearTimer()
      openTimer = setTimeout(() => {
        open.value = true
        openTimer = null
      }, HOVER_OPEN_DELAY)
    }

    onScopeDispose(clearTimer)

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
      placement: 'right-start',
      offset: 0,
      closeRoot: parentCtx.closeRoot,
    })

    const onTriggerPointerEnter = () => scheduleOpen()
    const onTriggerPointerLeave = () => clearTimer()
    const onTriggerClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      clearTimer()
      open.value = !open.value
    }
    const onTriggerKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        open.value = true
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        open.value = false
      }
    }

    watch(open, async (next) => {
      if (next) {
        // Focus first item in submenu.
        await new Promise((r) => setTimeout(r, 0))
        const first = contentRef.value?.querySelector<HTMLElement>('[role="menuitem"]')
        first?.focus()
      } else {
        // Return focus to this submenu's trigger.
        triggerRef.value?.focus?.()
      }
    })

    const onContentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'Escape') {
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
            padding: '6px var(--iris-padding-md)',
            borderRadius: 'var(--iris-radius-sm)',
            cursor: 'pointer',
            outline: 'none',
            fontSize: '14px',
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
              'data-state': 'open',
              onKeydown: onContentKeyDown,
              onPointerenter: clearTimer,
              style: {
                ...floatingStyles.value,
                background: 'var(--iris-surface)',
                color: 'var(--iris-foreground)',
                border: '1px solid var(--iris-border)',
                borderRadius: 'var(--iris-radius-md)',
                padding: 'var(--iris-padding-sm)',
                boxShadow:
                  '0 8px 24px -8px rgba(0, 0, 0, 0.16), 0 4px 8px -2px rgba(0, 0, 0, 0.08)',
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
