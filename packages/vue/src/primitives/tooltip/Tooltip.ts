import {
  Fragment,
  Teleport,
  defineComponent,
  h,
  onScopeDispose,
  ref,
  useId,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import { createHoverIntent, type Placement } from '@iris-ui/core'
import { useFloating } from '../floating/useFloating'
import { composeRefs, findFirstElement, mergeSlotProps } from '../slot/Slot'

/**
 * Hover / focus triggered tooltip. Powered by `createHoverIntent` state machine.
 *
 * Zero-delay uses `hi.open()`/`hi.close()` (FORCE_OPEN/FORCE_CLOSE — single
 * machine transition) so Vue reactively updates synchronously. Positive delays
 * use `hi.pointerEnter()`/`hi.pointerLeave()` with the machine's after-timer.
 *
 * @example
 *  <IrisTooltip content="Save changes">
 *    <IrisButton>Save</IrisButton>
 *  </IrisTooltip>
 */
export const IrisTooltip = defineComponent({
  name: 'IrisTooltip',
  inheritAttrs: false,
  props: {
    /** Plain-text tooltip content. Use the `content` slot for rich content. */
    content: { type: String, default: '' },
    /** Side relative to the trigger; may flip to stay in view. */
    placement: { type: String as PropType<Placement>, default: 'top' },
    /** Pixel offset between trigger and tooltip. */
    offset: { type: Number, default: 6 },
    /** Hover/focus dwell before opening, in ms. */
    openDelay: { type: Number, default: 600 },
    /** Hover/blur dwell before closing, in ms. */
    closeDelay: { type: Number, default: 0 },
    /** Teleport target — pass `false` to render in place. */
    teleport: {
      type: [String, Object, Boolean] as PropType<string | HTMLElement | false>,
      default: 'body',
    },
    /** Portal target (cross-framework alias for `teleport`). Overrides `teleport` when set. */
    portalTarget: {
      type: [String, Object, Boolean] as PropType<string | HTMLElement | false>,
      default: undefined,
    },
    /** Disable the tooltip without removing the trigger. */
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const triggerRef = ref<HTMLElement | null>(null)
    const tooltipRef = ref<HTMLElement | null>(null)
    const tooltipId = useId()
    const open = ref(false)

    // createHoverIntent with synchronous onChange bridge to Vue ref.
    let hi: ReturnType<typeof createHoverIntent> = createHoverIntent({
      openDelay: props.openDelay,
      closeDelay: props.closeDelay,
      onChange: (v) => {
        open.value = v
      },
    })

    // Re-create when delays change (watcher fires on mount too).
    watch(
      () => [props.openDelay, props.closeDelay],
      ([od, cd]) => {
        hi.stop()
        hi = createHoverIntent({
          openDelay: od,
          closeDelay: cd,
          onChange: (v) => {
            open.value = v
          },
        })
      },
    )

    onScopeDispose(() => hi.stop())

    // Escape closes immediately.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open.value) hi.close()
    }
    watch(open, (isOpen) => {
      if (typeof document === 'undefined') return
      if (isOpen) document.addEventListener('keydown', onKeyDown)
      else document.removeEventListener('keydown', onKeyDown)
    })

    // If disabled while open, close immediately.
    watch(
      () => props.disabled,
      (disabled) => {
        if (disabled && open.value) hi.close()
      },
    )

    const { floatingStyles } = useFloating({
      anchor: triggerRef,
      floating: tooltipRef,
      open,
      placement: props.placement,
      offset: props.offset,
    })

    // 0-delay → FORCE_OPEN/COSE (single transition, sync Vue reactivity).
    // Positive delay → pointerEnter/Leave (machine after-timer).
    const handleEnter = () => {
      if (props.disabled) return
      if (props.openDelay > 0) hi.pointerEnter()
      else hi.open()
    }
    const handleLeave = () => {
      if (props.disabled) return
      if (props.closeDelay > 0) hi.pointerLeave()
      else hi.close()
    }

    const triggerListeners: Record<string, (event: Event) => void> = {
      onPointerenter: handleEnter as unknown as (e: Event) => void,
      onPointerleave: handleLeave as unknown as (e: Event) => void,
      onFocus: (() => {
        if (!props.disabled) hi.open()
      }) as unknown as (e: Event) => void,
      onBlur: (() => {
        if (!props.disabled) hi.close()
      }) as unknown as (e: Event) => void,
    }

    const captureTriggerRef = (el: unknown) => {
      triggerRef.value = (el ?? null) as HTMLElement | null
    }

    const renderTrigger = () => {
      const root = findFirstElement(slots.default?.())
      if (!root) {
        if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'production') {
          console.warn(
            '[iris-ui] IrisTooltip requires a single trigger element in the default slot',
          )
        }
        return null
      }

      const parentProps: Record<string, unknown> = {
        ...triggerListeners,
        ref: captureTriggerRef,
        'aria-describedby': open.value ? tooltipId : undefined,
      }

      const merged = mergeSlotProps(parentProps, (root.props ?? {}) as Record<string, unknown>)
      if (root.props && 'ref' in root.props) {
        merged.ref = composeRefs(captureTriggerRef, (root.props as Record<string, unknown>).ref)
      }
      return h(root.type as string, merged, root.children as unknown as VNode[])
    }

    const renderTooltip = (): VNode | null => {
      if (!open.value) return null
      const tooltipNode = h(
        'div',
        {
          ...attrs,
          ref: (el: unknown) => {
            tooltipRef.value = (el ?? null) as HTMLElement | null
          },
          id: tooltipId,
          role: 'tooltip',
          'data-state': open.value ? 'open' : 'closed',
          'data-placement': props.placement,
          style: {
            ...floatingStyles.value,
            background: 'var(--iris-foreground)',
            color: 'var(--iris-background)',
            padding: '4px 8px',
            borderRadius: 'var(--iris-radius-sm)',
            fontSize: '12px',
            lineHeight: '1.4',
            maxWidth: '240px',
            pointerEvents: 'none',
            zIndex: '1100',
            ...((attrs.style as Record<string, string> | undefined) ?? {}),
          },
        },
        slots.content?.() ?? props.content,
      )
      const portalDest = props.portalTarget !== undefined ? props.portalTarget : props.teleport
      if (portalDest === false) return tooltipNode
      return h(Teleport, { to: portalDest as string | HTMLElement }, [tooltipNode])
    }

    return () => {
      const trigger = renderTrigger()
      const tooltip = renderTooltip()
      return h(Fragment, null, [trigger, tooltip])
    }
  },
})
