import { computed, defineComponent, provide, ref, useId, watch } from 'vue'
import { createFloatingMachine } from '@iris-ui-kit/core'
import { useMachine } from '../../machine/useMachine'
import { DialogContextKey } from './context'

/**
 * Modal dialog root. Wraps a Trigger + Content (+ optional Title /
 * Description / Close) and threads a state machine + DOM refs + IDs through
 * provide / inject. Supports controlled (`open` + `@update:open`) and
 * uncontrolled (`defaultOpen`) modes.
 *
 * Unlike `IrisPopover`, Dialog:
 *   - centers content with no anchor positioning,
 *   - locks body scroll while open,
 *   - traps Tab focus inside the content,
 *   - renders a backdrop overlay that dismisses on click.
 */
export const IrisDialog = defineComponent({
  name: 'IrisDialog',
  props: {
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: false },
    /** Close on backdrop click. Default `true`. */
    closeOnOutsideClick: { type: Boolean, default: true },
    /** Close on Escape key. Default `true`. */
    closeOnEscape: { type: Boolean, default: true },
  },
  emits: {
    'update:open': (_value: boolean) => true,
  },
  setup(props, { slots, emit }) {
    const isControlled = computed(() => props.open !== undefined)

    const machine = createFloatingMachine(props.defaultOpen ? 'open' : 'closed')
    const { state, send } = useMachine(machine)

    watch(
      () => props.open,
      (value) => {
        if (value === undefined) return
        const currentlyOpen = state.value.value === 'open'
        if (value && !currentlyOpen) send({ type: 'OPEN' })
        if (!value && currentlyOpen) send({ type: 'CLOSE' })
      },
      { immediate: true },
    )

    const open = computed(() =>
      isControlled.value ? Boolean(props.open) : state.value.value === 'open',
    )

    const setOpen = (value: boolean) => {
      if (!isControlled.value) {
        send({ type: value ? 'OPEN' : 'CLOSE' })
      }
      emit('update:open', value)
    }

    const triggerRef = ref<HTMLElement | null>(null)
    const contentRef = ref<HTMLElement | null>(null)
    const contentId = useId()
    const titleId = useId()
    const descriptionId = useId()
    const hasTitle = ref(false)
    const hasDescription = ref(false)

    provide(DialogContextKey, {
      machine,
      open,
      setOpen,
      triggerRef,
      contentRef,
      contentId,
      titleId,
      descriptionId,
      hasTitle,
      hasDescription,
      closeOnOutsideClick: props.closeOnOutsideClick,
      closeOnEscape: props.closeOnEscape,
    })

    return () => slots.default?.()
  },
})
