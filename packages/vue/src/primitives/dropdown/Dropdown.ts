import { computed, defineComponent, provide, ref, useId, watch, type PropType } from 'vue'
import { createFloatingMachine, type Placement } from '@iris-ui/core'
import { useMachine } from '../../machine/useMachine'
import { DropdownContextKey } from './context'

/**
 * Dropdown menu root. Composes `createFloatingMachine` (state) with
 * `useFloating` (positioning) and `useDismiss` (close-on-outside / Escape) —
 * all delegated to the standard hooks used by `IrisPopover`. The dropdown
 * panel's semantics differ from a popover: it uses `role="menu"`, supports
 * arrow-key navigation among items, and items auto-close the menu when
 * selected.
 *
 * @example
 *   <IrisDropdown placement="bottom-end">
 *     <IrisDropdownTrigger as-child>
 *       <IrisButton>Actions</IrisButton>
 *     </IrisDropdownTrigger>
 *     <IrisDropdownMenu>
 *       <IrisDropdownItem @select="onCopy">Copy</IrisDropdownItem>
 *       <IrisDropdownItem @select="onDelete">Delete</IrisDropdownItem>
 *     </IrisDropdownMenu>
 *   </IrisDropdown>
 */
export const IrisDropdown = defineComponent({
  name: 'IrisDropdown',
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

    provide(DropdownContextKey, {
      open,
      setOpen,
      triggerRef: ref(null),
      contentRef: ref(null),
      contentId: useId(),
      placement: props.placement,
      offset: props.offset,
    })

    return () => slots.default?.()
  },
})
