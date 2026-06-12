import { Teleport, defineComponent, h, inject, ref, watch, type VNode } from 'vue'
import { DrawerContextKey } from './context'
import { useFocusTrap, useBodyScrollLock } from '../modal-utils'
import { findFirstElement, mergeSlotProps } from '../slot/Slot'

const SIDE_TO_TRANSFORM: Record<string, string> = {
  left: 'translateX(-100%)',
  right: 'translateX(100%)',
  top: 'translateY(-100%)',
  bottom: 'translateY(100%)',
}

/**
 * Safe-area padding for the screen edges the panel actually touches, so its
 * content clears the notch / home indicator on mobile webviews (Cordova). The
 * insets resolve to 0 on devices/orientations without a cutout, and the whole
 * declaration is simply ignored on engines without env() support.
 * (Host must set <meta name="viewport" content="...,viewport-fit=cover">.)
 */
function safeAreaPadding(side: string): Record<string, string> {
  const top = 'max(0px, env(safe-area-inset-top))'
  const right = 'max(0px, env(safe-area-inset-right))'
  const bottom = 'max(0px, env(safe-area-inset-bottom))'
  const left = 'max(0px, env(safe-area-inset-left))'
  switch (side) {
    case 'left':
      return { paddingTop: top, paddingBottom: bottom, paddingLeft: left }
    case 'right':
      return { paddingTop: top, paddingBottom: bottom, paddingRight: right }
    case 'top':
      return { paddingTop: top, paddingLeft: left, paddingRight: right }
    case 'bottom':
      return { paddingBottom: bottom, paddingLeft: left, paddingRight: right }
    default:
      return {}
  }
}

function panelPositionStyle(side: string, size: string): Record<string, string> {
  const base: Record<string, string> = {
    position: 'fixed',
    background: 'var(--iris-background)',
    color: 'var(--iris-foreground)',
    boxShadow: 'var(--iris-shadow-md, 0 8px 24px rgba(0,0,0,.18))',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    transition: 'transform 220ms ease',
    willChange: 'transform',
    ...safeAreaPadding(side),
  }
  // `100vh` is the fallback; `maxHeight: 100dvh` clamps full-height side panels to
  // the DYNAMIC viewport so they don't overflow under mobile browser chrome
  // (dvh ≤ vh). A separate property, so it's simply ignored where dvh is
  // unsupported, leaving the 100vh fallback.
  switch (side) {
    case 'left':
      return {
        ...base,
        top: '0',
        bottom: '0',
        left: '0',
        width: size,
        height: '100vh',
        maxHeight: '100dvh',
      }
    case 'right':
      return {
        ...base,
        top: '0',
        bottom: '0',
        right: '0',
        width: size,
        height: '100vh',
        maxHeight: '100dvh',
      }
    case 'top':
      return { ...base, top: '0', left: '0', right: '0', width: '100vw', height: size }
    case 'bottom':
      return { ...base, bottom: '0', left: '0', right: '0', width: '100vw', height: size }
    default:
      return base
  }
}

/**
 * The slide-in surface. Renders only while open OR while the close animation
 * is still playing — controlled via a small "isExiting" timer so the
 * `transform: translate(0)` → `transform: translate(±100%)` transition runs
 * before unmount.
 *
 * Behaviors:
 *   - Body scroll lock (reference-counted, see modal-utils).
 *   - Focus trap; returns focus to the trigger on close.
 *   - Escape (when `closeOnEscape`) + click-on-backdrop (when
 *     `closeOnOutsideClick`) → close.
 */
export const IrisDrawerContent = defineComponent({
  name: 'IrisDrawerContent',
  inheritAttrs: false,
  setup(_props, { slots, attrs }) {
    const ctx = inject(DrawerContextKey)
    if (!ctx) {
      throw new Error('IrisDrawerContent must be used inside <IrisDrawer>')
    }

    const mounted = ref(false)
    const visible = ref(false) // controls the transform — toggled one frame after mount
    let exitTimer: ReturnType<typeof setTimeout> | null = null

    watch(
      ctx.open,
      (open) => {
        if (open) {
          if (exitTimer) {
            clearTimeout(exitTimer)
            exitTimer = null
          }
          mounted.value = true
          // Wait one frame so the initial off-screen transform is committed
          // BEFORE we set it to on-screen — otherwise the transition is skipped.
          requestAnimationFrame(() => {
            visible.value = true
          })
        } else if (mounted.value) {
          visible.value = false
          exitTimer = setTimeout(() => {
            mounted.value = false
            exitTimer = null
          }, 220)
        }
      },
      { immediate: true },
    )

    useBodyScrollLock(ctx.open)
    useFocusTrap({
      container: ctx.contentRef,
      active: ctx.open,
      returnFocusTo: ctx.triggerRef,
    })

    if (ctx.closeOnEscape) {
      watch(
        ctx.open,
        (open, _prev, onCleanup) => {
          if (!open) return
          const handler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              ctx.setOpen(false)
            }
          }
          document.addEventListener('keydown', handler)
          onCleanup(() => document.removeEventListener('keydown', handler))
        },
        { immediate: true },
      )
    }

    const onBackdropClick = (event: MouseEvent) => {
      if (!ctx.closeOnOutsideClick) return
      if (event.target !== event.currentTarget) return
      ctx.setOpen(false)
    }

    return () => {
      if (!mounted.value) return null

      const side = ctx.side.value
      const panelStyle = panelPositionStyle(side, ctx.size.value)
      const offScreen = SIDE_TO_TRANSFORM[side] ?? 'translateX(100%)'

      return h(Teleport, { to: 'body' }, [
        h(
          'div',
          {
            'data-iris-drawer-backdrop': '',
            'data-state': visible.value ? 'open' : 'closed',
            style: {
              position: 'fixed',
              inset: '0',
              background: 'rgba(0,0,0,.4)',
              opacity: visible.value ? '1' : '0',
              transition: 'opacity 220ms ease',
            },
            onClick: onBackdropClick,
          },
          h(
            'div',
            {
              ...attrs,
              ref: (el: unknown) => {
                ctx.contentRef.value = (el ?? null) as HTMLElement | null
              },
              role: 'dialog',
              'aria-modal': 'true',
              'aria-labelledby': ctx.hasTitle.value ? ctx.titleId : undefined,
              id: ctx.contentId,
              'data-iris-drawer-content': '',
              'data-iris-drawer-side': side,
              'data-state': visible.value ? 'open' : 'closed',
              tabindex: -1,
              style: {
                ...panelStyle,
                transform: visible.value ? 'translate(0,0)' : offScreen,
                ...((attrs.style as Record<string, string> | undefined) ?? {}),
              },
            },
            slots.default?.(),
          ),
        ),
      ])
    }
  },
})

/** Accessible title; wiring `aria-labelledby` on the surface. */
export const IrisDrawerTitle = defineComponent({
  name: 'IrisDrawerTitle',
  inheritAttrs: false,
  setup(_props, { slots, attrs }) {
    const ctx = inject(DrawerContextKey)
    if (!ctx) throw new Error('IrisDrawerTitle must be used inside <IrisDrawer>')
    ctx.hasTitle.value = true
    return () =>
      h(
        'h2',
        {
          id: ctx.titleId,
          'data-iris-drawer-title': '',
          style: {
            margin: '0',
            padding: 'var(--iris-padding-md)',
            fontSize: 'var(--iris-font-size-lg, 16px)',
            fontWeight: '600',
            borderBottom: '1px solid var(--iris-border)',
          },
          ...attrs,
        },
        slots.default?.(),
      )
  },
})

/** Close button that calls `setOpen(false)`. Supports `as-child`. */
export const IrisDrawerClose = defineComponent({
  name: 'IrisDrawerClose',
  inheritAttrs: false,
  props: {
    asChild: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const ctx = inject(DrawerContextKey)
    if (!ctx) throw new Error('IrisDrawerClose must be used inside <IrisDrawer>')

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      ctx.setOpen(false)
    }

    return () => {
      const baseProps: Record<string, unknown> = {
        type: 'button',
        'data-iris-drawer-close': '',
        onClick,
        ...attrs,
      }
      if (props.asChild) {
        const child = findFirstElement(slots.default?.()) as VNode | null
        if (!child) return null
        const merged = mergeSlotProps(baseProps, (child.props ?? {}) as Record<string, unknown>)
        return h(child.type as never, merged, child.children as never)
      }
      return h('button', baseProps, slots.default?.())
    }
  },
})
