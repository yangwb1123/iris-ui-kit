import { computed, defineComponent, provide, ref, useId, watch, type PropType } from 'vue'
import { createFloatingMachine, type Placement } from '@iris-ui-kit/core'
import { useMachine } from '../../machine/useMachine'
import { PopoverContextKey } from './context'

/**
 * Root provider for a Popover surface. Wraps the trigger and the content,
 * threads a state machine + DOM refs + positioning options through provide /
 * inject. Supports controlled (`open` + `@update:open`) and uncontrolled
 * (`defaultOpen`) modes.
 *
 * Composition:
 *
 *   <IrisPopover v-model:open="open" placement="bottom-start">
 *     <IrisPopoverTrigger>Click me</IrisPopoverTrigger>
 *     <IrisPopoverContent>...</IrisPopoverContent>
 *   </IrisPopover>
 */
export const IrisPopover = defineComponent({
  name: 'IrisPopover',
  props: {
    /** Controlled open value. Combine with `@update:open` (or `v-model:open`). */
    open: { type: Boolean, default: undefined },
    /** Initial open value in uncontrolled mode. */
    defaultOpen: { type: Boolean, default: false },
    /** Anchor placement; may be flipped by Floating UI to stay in view. */
    placement: { type: String as PropType<Placement>, default: 'bottom-start' },
    /** Distance in px between trigger and content. */
    offset: { type: Number, default: 8 },
  },
  emits: {
    'update:open': (_value: boolean) => true,
  },
  setup(props, { slots, emit }) {
    const isControlled = computed(() => props.open !== undefined)

    const machine = createFloatingMachine(props.defaultOpen ? 'open' : 'closed')
    const { state, send } = useMachine(machine)

    // Sync controlled prop → machine
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

    provide(PopoverContextKey, {
      machine,
      open,
      setOpen,
      triggerRef,
      contentRef,
      contentId,
      placement: props.placement,
      offset: props.offset,
    })

    return () => slots.default?.()
  },
})
