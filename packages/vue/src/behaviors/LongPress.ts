import { defineComponent, h, onBeforeUnmount, watch, type PropType } from 'vue'
import { createLongPress } from '@iris-ui-kit/core'

/**
 * Behavior wrapper: fires `onLongPress` once the pointer has been held down
 * for `holdDelay` ms without an intervening pointerup/pointerleave. Wraps
 * children in a `<span data-iris-long-press style="display:contents">` so it
 * doesn't affect layout. Backed by `createLongPress`'s statechart timer.
 *
 * @example
 *   <IrisLongPress :hold-delay="500" @longpress="onLongPress">
 *     <IrisButton>Hold me</IrisButton>
 *   </IrisLongPress>
 */
export const IrisLongPress = defineComponent({
  name: 'IrisLongPress',
  inheritAttrs: false,
  props: {
    /** Time the pointer must be held before `onLongPress` fires, in ms. */
    holdDelay: {
      type: Number,
      default: 500,
    },
    /** Called once when the hold reaches `holdDelay` without an intervening release. */
    onLongPress: {
      type: Function as PropType<() => void>,
      default: undefined,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
  },
  emits: {
    longpress: () => true,
  },
  setup(props, { slots, emit }) {
    const fire = () => {
      props.onLongPress?.()
      emit('longpress')
    }
    // `let`, not `const`: reassigned on holdDelay change; closures (handlers,
    // unmount hook) read the CURRENT binding.
    let ctrl = createLongPress({ holdDelay: props.holdDelay, onLongPress: fire })

    const onPointerDown = () => {
      if (props.disabled) return
      ctrl.press()
    }
    const onPointerUp = () => {
      ctrl.release()
    }
    const onPointerLeave = () => {
      ctrl.cancel()
    }
    // Touch scroll / system gesture: the pointer is removed from the active
    // set without pointerup — send CANCEL so the pending hold never fires.
    const onPointerCancel = () => {
      ctrl.cancel()
    }

    // holdDelay prop changes re-arm the timer with the new value.
    watch(
      () => props.holdDelay,
      (holdDelay) => {
        const wasPressing = ctrl.state() === 'pressing'
        ctrl.cancel() // clears the pending after-timer (machine exit cancels pending)
        ctrl = createLongPress({ holdDelay, onLongPress: fire })
        if (wasPressing) ctrl.press() // re-arm with the new delay
      },
    )

    // disabled flipping true mid-hold aborts the pending gesture.
    watch(
      () => props.disabled,
      (disabled) => {
        if (disabled) ctrl.cancel()
      },
    )

    onBeforeUnmount(() => ctrl.cancel())

    return () =>
      h(
        'span',
        {
          'data-iris-long-press': '',
          style: { display: 'contents' },
          onPointerdown: onPointerDown,
          onPointerup: onPointerUp,
          onPointerleave: onPointerLeave,
          onPointercancel: onPointerCancel,
        },
        slots.default?.(),
      )
  },
})
