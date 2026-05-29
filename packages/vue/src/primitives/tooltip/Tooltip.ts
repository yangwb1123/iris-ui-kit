import {
  Fragment,
  Teleport,
  computed,
  defineComponent,
  h,
  onScopeDispose,
  ref,
  useId,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import { createFloatingMachine, type Placement } from '@iris-ui/core'
import { useMachine } from '../../machine/useMachine'
import { useFloating } from '../floating/useFloating'
import { composeRefs, findFirstElement, mergeSlotProps } from '../slot/Slot'

/**
 * Hover / focus triggered tooltip. Wraps a single child element (no wrapping
 * markup is added — behavior is attached via `mergeSlotProps`). Opens after
 * `openDelay` ms of pointer hover or focus on the trigger; closes after
 * `closeDelay` ms when the pointer leaves and focus departs.
 *
 * Accessibility:
 *   - The tooltip element gets `role="tooltip"` + a stable id.
 *   - The trigger gets `aria-describedby` pointing at that id while open.
 *   - Tooltips do not trap focus and are non-interactive.
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
    /** Disable the tooltip without removing the trigger. */
    disabled: { type: Boolean, default: false },
  },
  setup(props, { slots, attrs }) {
    const triggerRef = ref<HTMLElement | null>(null)
    const tooltipRef = ref<HTMLElement | null>(null)
    const tooltipId = useId()

    const machine = createFloatingMachine('closed')
    const { state, send } = useMachine(machine)
    const open = computed(() => state.value.value === 'open')

    let openTimer: ReturnType<typeof setTimeout> | null = null
    let closeTimer: ReturnType<typeof setTimeout> | null = null

    const clearTimers = () => {
      if (openTimer) {
        clearTimeout(openTimer)
        openTimer = null
      }
      if (closeTimer) {
        clearTimeout(closeTimer)
        closeTimer = null
      }
    }

    const scheduleOpen = () => {
      if (props.disabled) return
      clearTimers()
      if (props.openDelay <= 0) {
        send({ type: 'OPEN' })
        return
      }
      openTimer = setTimeout(() => {
        send({ type: 'OPEN' })
        openTimer = null
      }, props.openDelay)
    }

    const scheduleClose = () => {
      clearTimers()
      if (props.closeDelay <= 0) {
        send({ type: 'CLOSE' })
        return
      }
      closeTimer = setTimeout(() => {
        send({ type: 'CLOSE' })
        closeTimer = null
      }, props.closeDelay)
    }

    // Hide immediately on Escape (skip closeDelay).
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open.value) {
        clearTimers()
        send({ type: 'CLOSE' })
      }
    }

    watch(
      open,
      (isOpen) => {
        if (typeof document === 'undefined') return
        if (isOpen) document.addEventListener('keydown', onKeyDown)
        else document.removeEventListener('keydown', onKeyDown)
      },
      { flush: 'post' },
    )

    onScopeDispose(() => {
      clearTimers()
      if (typeof document !== 'undefined') {
        document.removeEventListener('keydown', onKeyDown)
      }
    })

    // If `disabled` flips while open, close immediately.
    watch(
      () => props.disabled,
      (disabled) => {
        if (disabled && open.value) {
          clearTimers()
          send({ type: 'CLOSE' })
        }
      },
    )

    const { floatingStyles } = useFloating({
      anchor: triggerRef,
      floating: tooltipRef,
      open,
      placement: props.placement,
      offset: props.offset,
    })

    const triggerListeners: Record<string, (event: Event) => void> = {
      onPointerenter: scheduleOpen as unknown as (e: Event) => void,
      onPointerleave: scheduleClose as unknown as (e: Event) => void,
      onFocus: scheduleOpen as unknown as (e: Event) => void,
      onBlur: scheduleClose as unknown as (e: Event) => void,
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
      // If the user's child already had a ref, compose them so theirs still fires.
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
      if (props.teleport === false) return tooltipNode
      return h(Teleport, { to: props.teleport as string | HTMLElement }, [tooltipNode])
    }

    return () => {
      const trigger = renderTrigger()
      const tooltip = renderTooltip()
      // Always return a Fragment so Vue can diff the trigger across open/close
      // without a shape change. Children may include `null` when closed.
      return h(Fragment, null, [trigger, tooltip])
    }
  },
})
