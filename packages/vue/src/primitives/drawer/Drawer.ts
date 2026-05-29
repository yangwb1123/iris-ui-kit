import { computed, defineComponent, provide, ref, useId, watch, type PropType } from 'vue'
import { createFloatingMachine } from '@iris-ui/core'
import { useMachine } from '../../machine/useMachine'
import { DrawerContextKey, type IrisDrawerSide } from './context'

/**
 * Slide-in overlay. Mirrors {@link IrisDialog}'s composition but renders on
 * one screen edge with a transform-based open animation. Defaults to the
 * right edge.
 *
 * Composition:
 *
 * ```html
 * <IrisDrawer v-model:open="open">
 *   <IrisDrawerTrigger>Open</IrisDrawerTrigger>
 *   <IrisDrawerContent>
 *     <IrisDrawerTitle>Settings</IrisDrawerTitle>
 *     <p>...</p>
 *     <IrisDrawerClose>Close</IrisDrawerClose>
 *   </IrisDrawerContent>
 * </IrisDrawer>
 * ```
 */
export const IrisDrawer = defineComponent({
  name: 'IrisDrawer',
  inheritAttrs: false,
  props: {
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: false },
    side: { type: String as PropType<IrisDrawerSide>, default: 'right' },
    /** Width (for left/right) or height (for top/bottom). Any CSS length. */
    size: { type: String, default: '320px' },
    closeOnOutsideClick: { type: Boolean, default: true },
    closeOnEscape: { type: Boolean, default: true },
  },
  emits: {
    'update:open': (_value: boolean) => true,
  },
  setup(props, { slots, emit }) {
    const machine = createFloatingMachine((props.open ?? props.defaultOpen) ? 'open' : 'closed')
    const { state } = useMachine(machine)

    const isControlled = computed(() => props.open !== undefined)
    const open = computed(() =>
      isControlled.value ? Boolean(props.open) : state.value.value === 'open',
    )

    const setOpen = (value: boolean) => {
      if (!isControlled.value) {
        machine.send({ type: value ? 'OPEN' : 'CLOSE' })
      }
      emit('update:open', value)
    }

    watch(
      () => props.open,
      (value) => {
        if (value === undefined) return
        machine.send({ type: value ? 'OPEN' : 'CLOSE' })
      },
    )

    const id = useId()
    const triggerRef = ref<HTMLElement | null>(null)
    const contentRef = ref<HTMLElement | null>(null)
    const hasTitle = ref(false)

    provide(DrawerContextKey, {
      machine,
      open,
      setOpen,
      triggerRef,
      contentRef,
      contentId: `${id}-content`,
      titleId: `${id}-title`,
      side: computed(() => props.side),
      size: computed(() => props.size),
      closeOnOutsideClick: props.closeOnOutsideClick,
      closeOnEscape: props.closeOnEscape,
      hasTitle,
    })

    return () => slots.default?.()
  },
})
