<script lang="ts">
  import { createFloatingMachine, generateId } from '@iris-ui/core'
  import { toMachine } from '../../useMachine'
  import { setDropdownContext, type DropdownContextValue } from './context'
  import type { IrisDropdownProps } from './types'

  let {
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    placement = 'bottom-start',
    offset = 6,
    children,
  }: IrisDropdownProps = $props()

  const isControlled = $derived(openProp !== undefined)

  // svelte-ignore state_referenced_locally — initial machine state; controlled changes sync below.
  const { state: machineState, send } = toMachine(
    createFloatingMachine(defaultOpen ? 'open' : 'closed'),
  )
  const internalOpen = $derived($machineState.value === 'open')

  // Keep the machine in sync with a controlled `open` prop.
  $effect(() => {
    if (!isControlled) return
    const target = openProp ? 'open' : 'closed'
    if ($machineState.value !== target) send({ type: openProp ? 'OPEN' : 'CLOSE' })
  })

  const open = $derived(isControlled ? Boolean(openProp) : internalOpen)
  function setOpen(next: boolean): void {
    if (!isControlled) send({ type: next ? 'OPEN' : 'CLOSE' })
    onOpenChange?.(next)
  }

  let triggerEl = $state<HTMLElement | undefined>(undefined)
  let contentEl = $state<HTMLElement | undefined>(undefined)
  const contentId = generateId()

  setDropdownContext({
    get open() {
      return open
    },
    setOpen,
    get trigger() {
      return triggerEl
    },
    setTrigger: (el) => {
      triggerEl = el
    },
    get content() {
      return contentEl
    },
    setContent: (el) => {
      contentEl = el
    },
    contentId,
    get placement() {
      return placement
    },
    get offset() {
      return offset
    },
  } satisfies DropdownContextValue)
</script>

{@render children?.()}
