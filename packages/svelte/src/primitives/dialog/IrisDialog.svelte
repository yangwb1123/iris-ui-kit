<script lang="ts">
  import { createFloatingMachine, generateId } from '@iris-ui-kit/core'
  import { toMachine } from '../../useMachine'
  import { setDialogContext } from './context'

  interface Props {
    open?: boolean
    defaultOpen?: boolean
    onOpenChange?: (open: boolean) => void
    closeOnOutsideClick?: boolean
    closeOnEscape?: boolean
    children?: import('svelte').Snippet
  }

  let {
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    closeOnOutsideClick = true,
    closeOnEscape = true,
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
  const baseId = generateId()
  const contentId = `${baseId}-content`
  const titleId = `${baseId}-title`
  const descriptionId = `${baseId}-desc`

  // Refcount mounted Title/Description so the content wires aria-labelledby /
  // aria-describedby only when one is actually present (mirrors React).
  let titleCount = $state(0)
  let descriptionCount = $state(0)

  setDialogContext({
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
    titleId,
    descriptionId,
    get hasTitle() {
      return titleCount > 0
    },
    get hasDescription() {
      return descriptionCount > 0
    },
    registerTitle: () => {
      titleCount += 1
      return () => {
        titleCount -= 1
      }
    },
    registerDescription: () => {
      descriptionCount += 1
      return () => {
        descriptionCount -= 1
      }
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
