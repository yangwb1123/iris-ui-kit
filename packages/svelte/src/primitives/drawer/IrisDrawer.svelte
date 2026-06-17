<script lang="ts">
  import { createFloatingMachine, generateId } from '@iris-ui/core'
  import { toMachine } from '../../useMachine'
  import { setDrawerContext, type IrisDrawerSide } from './context'

  interface Props {
    open?: boolean
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
    side?: IrisDrawerSide
    size?: string
    closeOnOutsideClick?: boolean
    closeOnEscape?: boolean
    children?: import('svelte').Snippet
  }

  let {
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    side = 'right',
    size = '320px',
    closeOnOutsideClick = true,
    closeOnEscape = true,
    children,
  }: Props = $props()

  const isControlled = $derived(openProp !== undefined)

  // svelte-ignore state_referenced_locally
  const { state: machineState, send } = toMachine(
    createFloatingMachine((openProp ?? defaultOpen) ? 'open' : 'closed'),
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
  const baseId = generateId()

  // Refcount mounted Title so the content wires aria-labelledby only when one
  // is present (mirrors React). Drawers have no Description component.
  let titleCount = $state(0)

  setDrawerContext({
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
    contentId: `${baseId}-content`,
    titleId: `${baseId}-title`,
    get hasTitle() {
      return titleCount > 0
    },
    registerTitle: () => {
      titleCount += 1
      return () => {
        titleCount -= 1
      }
    },
    get side() {
      return side
    },
    get size() {
      return size
    },
    get closeOnOutsideClick() {
      return closeOnOutsideClick
    },
    get closeOnEscape() {
      return closeOnEscape
    },
  })
</script>

{@render children?.()}
