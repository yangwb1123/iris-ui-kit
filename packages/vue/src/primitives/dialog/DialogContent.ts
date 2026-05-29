import { Teleport, defineComponent, h, inject, ref, watch, type PropType, type VNode } from 'vue'
import { DialogContextKey } from './context'
import { useFocusTrap, useBodyScrollLock } from '../modal-utils'
import { findFirstElement, mergeSlotProps } from '../slot/Slot'

/**
 * The modal surface (and its backdrop). Renders only while the dialog is
 * open. Behaviors enabled automatically:
 *
 *   - **Body scroll lock** — uses `useBodyScrollLock` (reference-counted).
 *   - **Focus trap** — uses `useFocusTrap`; restores focus to the trigger on close.
 *   - **Escape to dismiss** — controlled by `Dialog.closeOnEscape`.
 *   - **Backdrop click to dismiss** — controlled by `Dialog.closeOnOutsideClick`.
 *   - **ARIA** — `role="dialog"`, `aria-modal="true"`, `aria-labelledby` / `aria-describedby` wired automatically when `<IrisDialogTitle>` / `<IrisDialogDescription>` are present.
 */
export const IrisDialogContent = defineComponent({
  name: 'IrisDialogContent',
  inheritAttrs: false,
  props: {
    teleport: {
      type: [String, Object, Boolean] as PropType<string | HTMLElement | false>,
      default: 'body',
    },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(DialogContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisDialogContent must be a descendant of IrisDialog')
    }

    const innerRef = ref<HTMLElement | null>(null)
    watch(innerRef, (el) => {
      ctx.contentRef.value = el
    })

    useBodyScrollLock(ctx.open)
    useFocusTrap({
      container: innerRef,
      active: ctx.open,
      returnFocusTo: ctx.triggerRef,
    })

    // Escape handler — scoped to the document while open.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && ctx.closeOnEscape) {
        event.stopPropagation()
        ctx.setOpen(false)
      }
    }
    watch(
      ctx.open,
      (open) => {
        if (typeof document === 'undefined') return
        if (open) document.addEventListener('keydown', onKeyDown)
        else document.removeEventListener('keydown', onKeyDown)
      },
      { flush: 'post', immediate: true },
    )

    const onBackdropPointerDown = (event: Event) => {
      if (!ctx.closeOnOutsideClick) return
      if (event.target === event.currentTarget) {
        ctx.setOpen(false)
      }
    }

    const onContentPointerDown = (event: Event) => {
      // Stop bubbling so the backdrop doesn't see the click and close.
      event.stopPropagation()
    }

    return () => {
      if (!ctx.open.value) return null

      const backdrop = h(
        'div',
        {
          'data-iris-dialog-backdrop': '',
          onPointerdown: onBackdropPointerDown,
          style: {
            position: 'fixed',
            inset: '0',
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: '1200',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          },
        },
        [
          h(
            'div',
            {
              ...attrs,
              ref: (el: unknown) => {
                innerRef.value = (el ?? null) as HTMLElement | null
              },
              id: ctx.contentId,
              role: 'dialog',
              'aria-modal': 'true',
              'aria-labelledby': ctx.hasTitle.value ? ctx.titleId : undefined,
              'aria-describedby': ctx.hasDescription.value ? ctx.descriptionId : undefined,
              tabindex: -1,
              'data-state': 'open',
              onPointerdown: onContentPointerDown,
              style: {
                background: 'var(--iris-surface)',
                color: 'var(--iris-foreground)',
                border: '1px solid var(--iris-border)',
                borderRadius: 'var(--iris-radius-lg)',
                padding: 'var(--iris-padding-lg)',
                boxShadow: '0 24px 48px -16px rgba(0,0,0,0.32), 0 8px 16px -4px rgba(0,0,0,0.16)',
                maxWidth: '90vw',
                maxHeight: '85vh',
                overflow: 'auto',
                outline: 'none',
                ...((attrs.style as Record<string, string> | undefined) ?? {}),
              },
            },
            slots.default?.(),
          ),
        ],
      )

      if (props.teleport === false) return backdrop
      return h(Teleport, { to: props.teleport as string | HTMLElement }, [backdrop])
    }
  },
})

/**
 * Sets `aria-labelledby` on the dialog content automatically. Renders a
 * heading element (default `<h2>`).
 */
export const IrisDialogTitle = defineComponent({
  name: 'IrisDialogTitle',
  props: {
    as: { type: String, default: 'h2' },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(DialogContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisDialogTitle must be a descendant of IrisDialog')
    }
    ctx.hasTitle.value = true
    return () =>
      h(
        props.as,
        {
          ...attrs,
          id: ctx.titleId,
          style: {
            margin: '0 0 var(--iris-gap-md) 0',
            fontSize: '18px',
            fontWeight: '600',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
  },
})

/**
 * Sets `aria-describedby` on the dialog content automatically. Renders a
 * `<p>` by default.
 */
export const IrisDialogDescription = defineComponent({
  name: 'IrisDialogDescription',
  props: {
    as: { type: String, default: 'p' },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(DialogContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisDialogDescription must be a descendant of IrisDialog')
    }
    ctx.hasDescription.value = true
    return () =>
      h(
        props.as,
        {
          ...attrs,
          id: ctx.descriptionId,
          style: {
            margin: '0 0 var(--iris-gap-lg) 0',
            color: 'var(--iris-muted)',
            fontSize: '14px',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.default?.(),
      )
  },
})

/** Close button. Supports `as-child`. */
export const IrisDialogClose = defineComponent({
  name: 'IrisDialogClose',
  inheritAttrs: false,
  props: {
    asChild: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(DialogContextKey)
    if (!ctx) {
      throw new Error('[iris-ui] IrisDialogClose must be a descendant of IrisDialog')
    }
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      ctx.setOpen(false)
    }
    return () => {
      const baseProps: Record<string, unknown> = { onClick }
      if (props.asChild) {
        const root = findFirstElement(slots.default?.())
        if (!root) return null
        const parentSide = mergeSlotProps(attrs as Record<string, unknown>, baseProps)
        const merged = mergeSlotProps(parentSide, (root.props ?? {}) as Record<string, unknown>)
        return h(root.type as string, merged, root.children as unknown as VNode[])
      }
      return h('button', { type: 'button', ...attrs, ...baseProps }, slots.default?.())
    }
  },
})
