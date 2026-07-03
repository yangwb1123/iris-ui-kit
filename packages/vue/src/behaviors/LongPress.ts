import { defineComponent, h, onBeforeUnmount, type PropType } from 'vue'
import { createLongPress } from '@iris-ui/core'

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
    const ctrl = createLongPress({
      holdDelay: props.holdDelay,
      onLongPress: () => {
        props.onLongPress?.()
        emit('longpress')
      },
    })

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
        },
        slots.default?.(),
      )
  },
})
