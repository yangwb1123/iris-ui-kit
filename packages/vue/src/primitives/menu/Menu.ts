import { computed, defineComponent, provide, ref, useId, watch, type PropType } from 'vue'
import { createFloatingMachine, type Placement } from '@iris-ui/core'
import { useMachine } from '../../machine/useMachine'
import { MenuContextKey } from './context'

/**
 * Root of a (potentially nested) menu. Provides the close-everything channel
 * to submenus so picking a leaf in a deeply nested branch closes the whole
 * tree at once. The root itself behaves like `IrisDropdown` — same state
 * machine, same positioning + dismiss semantics.
 *
 * Use `IrisMenuSub` inside content to declare nested submenus.
 */
export const IrisMenu = defineComponent({
  name: 'IrisMenu',
  props: {
    open: { type: Boolean, default: undefined },
    defaultOpen: { type: Boolean, default: false },
    placement: { type: String as PropType<Placement>, default: 'bottom-start' },
    offset: { type: Number, default: 6 },
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
      if (!isControlled.value) send({ type: value ? 'OPEN' : 'CLOSE' })
      emit('update:open', value)
    }

    const closeRoot = () => setOpen(false)

    provide(MenuContextKey, {
      open,
      setOpen,
      triggerRef: ref(null),
      contentRef: ref(null),
      contentId: useId(),
      placement: props.placement,
      offset: props.offset,
      closeRoot,
    })

    return () => slots.default?.()
  },
})
