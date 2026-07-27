<script lang="ts">
  import { untrack } from 'svelte'
  import { nextEnabledIndex } from '@iris-ui-kit/core'
  import { setTabsContext } from './context'

  type Orientation = 'horizontal' | 'vertical'

  interface TriggerReg {
    value: string
    isDisabled: () => boolean
  }

  interface Props {
    value?: string
    defaultValue?: string
    orientation?: Orientation
    disabled?: boolean
    lazy?: boolean
    style?: string
    children?: import('svelte').Snippet
    onchange?: (value: string) => void
    [key: string]: unknown
  }

  let {
    value: valueProp,
    defaultValue,
    orientation = 'horizontal',
    disabled = false,
    lazy = true,
    style,
    children,
    onchange,
    ...rest
  }: Props = $props()

  const isControlled = $derived(valueProp !== undefined)

  // svelte-ignore state_referenced_locally
  let internalValue = $state<string | null>(defaultValue ?? null)

  const effectiveValue = $derived(isControlled ? (valueProp ?? null) : internalValue)

  function setValue(next: string) {
    if (!isControlled) internalValue = next
    onchange?.(next)
  }

  // Plain (non-reactive) array — registration order matters for focus movement
  // but doesn't need to trigger re-renders in the root.
  const triggerRegistry: TriggerReg[] = []
  let listEl = $state<HTMLElement | null>(null)

  function registerTrigger(value: string, isDisabled: () => boolean) {
    if (triggerRegistry.some((t) => t.value === value)) return
    triggerRegistry.push({ value, isDisabled })
    // Use untrack to avoid triggering reactive effects when setting the default value.
    untrack(() => {
      if (internalValue === null && !isControlled && !isDisabled()) {
        internalValue = value
      }
    })
  }

  function unregisterTrigger(value: string) {
    const idx = triggerRegistry.findIndex((t) => t.value === value)
    if (idx >= 0) triggerRegistry.splice(idx, 1)
  }

  function focusTriggerByValue(v: string) {
    const root = listEl
    if (!root) return
    const el = root.querySelector<HTMLElement>(`[data-iris-tabs-trigger][data-value="${v}"]`)
    el?.focus()
  }

  function moveFocus(from: string, delta: 1 | -1 | 'home' | 'end') {
    const enabled = triggerRegistry.filter((t) => !t.isDisabled())
    if (enabled.length === 0) return
    const fromIndex = enabled.findIndex((t) => t.value === from)
    let nextIndex: number
    if (delta === 'home') nextIndex = 0
    else if (delta === 'end') nextIndex = enabled.length - 1
    // Skip-disabled is already done by the `enabled` filter above; the core
    // helper single-sources the ±1 wraparound (incl. the from-not-found case).
    else nextIndex = nextEnabledIndex(fromIndex, delta, enabled.length)
    const next = enabled[nextIndex]
    if (next) {
      setValue(next.value)
      focusTriggerByValue(next.value)
    }
  }

  setTabsContext({
    get value() {
      return effectiveValue
    },
    setValue,
    get orientation() {
      return orientation
    },
    get disabled() {
      return disabled
    },
    get lazy() {
      return lazy
    },
    registerTrigger,
    unregisterTrigger,
    moveFocus,
    getListEl: () => listEl,
    setListEl: (el) => {
      listEl = el
    },
  })
</script>

<div {...rest} data-iris-tabs data-iris-tabs-orientation={orientation} {style}>
  {@render children?.()}
</div>
