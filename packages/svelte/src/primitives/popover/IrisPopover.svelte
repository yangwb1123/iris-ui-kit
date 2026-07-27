<script lang="ts">
  import { createFloatingMachine, generateId } from '@iris-ui-kit/core'
  import { toMachine } from '../../useMachine'
  import { setPopoverContext } from './context'
  import type { Placement } from '@iris-ui-kit/core'

  interface Props {
    open?: boolean
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
    placement?: Placement
    offset?: number
    children?: import('svelte').Snippet
  }

  let {
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    placement = 'bottom-start',
    offset = 8,
    children,
  }: Props = $props()

  const isControlled = $derived(openProp !== undefined)

  // svelte-ignore state_referenced_locally
  const { state: machineState, send } = toMachine(
    createFloatingMachine(defaultOpen ? 'open' : 'closed'),
  )
  const internalOpen = $derived($machineState.value === 'open')

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

  setPopoverContext({
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
  })
</script>

{@render children?.()}
