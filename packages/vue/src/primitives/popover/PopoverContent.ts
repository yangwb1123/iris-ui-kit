import { Teleport, defineComponent, h, inject, nextTick, ref, watch, type PropType } from 'vue'
import { installFloatingAnimations, ANIM_POPOVER } from '../floating/animations'
import { useFloating } from '../floating/useFloating'
import { useDismiss } from '../floating/useDismiss'
import { PopoverContextKey } from './context'
/**
 * The floating panel rendered when the Popover is open. Position is computed
 * by `useFloating` (Floating UI); dismissal (outside pointerdown + Escape)
 * is handled by `useDismiss`. Focus moves into the content on open and back
 * to the trigger on close.
 *
 * The content is teleported to `document.body` by default to avoid stacking
 * / overflow / z-index foot-guns. Pass `:teleport="false"` to render inline.
 */
export const IrisPopoverContent = defineComponent({
  name: 'IrisPopoverContent',
  inheritAttrs: false,
  props: {
    /** Teleport target — pass `false` to render in place. */
    teleport: {
      type: [String, Object, Boolean] as PropType<string | HTMLElement | false>,
      default: 'body',
    },
  },
  setup(props, { slots, attrs }) {
    installFloatingAnimations()
    const ctx = inject(PopoverContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisPopoverContent must be a descendant of IrisPopover')
    }
    const innerRef = ref<HTMLElement | null>(null)
    // Mirror into ctx.contentRef so siblings (Trigger, useDismiss) can see it.
    watch(innerRef, (el) => {
      ctx.contentRef.value = el
    })
    const { floatingStyles } = useFloating({
      anchor: ctx.triggerRef,
      floating: innerRef,
      open: ctx.open,
      placement: ctx.placement,
      offset: ctx.offset,
    })
    useDismiss({
      enabled: ctx.open,
      exclude: [ctx.triggerRef, innerRef],
      onDismiss: () => ctx.setOpen(false),
    })
    // Focus management: focus content on open; restore focus to trigger on close.
    let lastFocused: HTMLElement | null = null
    watch(ctx.open, async (isOpen, wasOpen) => {
      if (isOpen && !wasOpen) {
        lastFocused = (document.activeElement as HTMLElement | null) ?? ctx.triggerRef.value
        await nextTick()
        innerRef.value?.focus()
      } else if (!isOpen && wasOpen) {
        const target = ctx.triggerRef.value ?? lastFocused
        target?.focus()
      }
    })
    // VNodes that carry refs must be created while this component is rendering.
    // Caching one in a computed can evaluate it from a floating-position watcher,
    // outside a render owner; Vue then crashes while mounting/unmounting the ref.
    const renderContent = () =>
      h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            innerRef.value = (el ?? null) as HTMLElement | null
          },
          id: ctx.contentId,
          role: 'dialog',
          tabindex: -1,
          'data-state': ctx.open.value ? 'open' : 'closed',
          'data-placement': ctx.placement,
          style: {
            ...floatingStyles.value,
            background: 'var(--iris-surface-floating)',
            animation: ANIM_POPOVER,
            color: 'var(--iris-foreground)',
            border: '1px solid var(--iris-border)',
            borderRadius: 'var(--iris-radius-md)',
            padding: 'var(--iris-padding-md)',
            boxShadow: 'var(--iris-shadow-lg)',
            fontSize: 'var(--iris-font-size-md, 14px)',
            zIndex: '1000',
            outline: 'none',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
    return () => {
      if (!ctx.open.value) return null
      const node = renderContent()
      if (props.teleport === false) return node
      return h(Teleport, { to: props.teleport as string | HTMLElement }, [node])
    }
  },
})
