<script lang="ts">
  import {
    generateId,
    createKeyboardNav,
    type KeyboardNavAction,
    type KeyboardNavController,
  } from '@iris-ui/core'
  import { setAccordionContext } from './context'

  type AccordionValue = string | string[] | null

  let {
    value: valueProp,
    defaultValue,
    multiple = false,
    collapsible = false,
    onValueChange,
    children,
    ...rest
  }: {
    value?: AccordionValue
    defaultValue?: AccordionValue
    multiple?: boolean
    collapsible?: boolean
    onValueChange?: (next: AccordionValue) => void
    children?: import('svelte').Snippet
    [key: string]: unknown
  } = $props()

  const isControlled = $derived(valueProp !== undefined)
  const rootId = generateId()

  // svelte-ignore state_referenced_locally
  let internal = $state<AccordionValue>(
    defaultValue !== undefined ? defaultValue : multiple ? [] : null,
  )

  $effect(() => {
    if (isControlled && valueProp !== undefined) {
      internal = valueProp
    }
  })

  const current = $derived(isControlled ? valueProp! : internal)

  function isOpen(val: string): boolean {
    const c = current
    if (c === null || c === undefined) return false
    if (Array.isArray(c)) return c.includes(val)
    return c === val
  }

  function toggle(val: string): void {
    const prev = current
    let next: AccordionValue
    if (multiple) {
      const arr = Array.isArray(prev) ? prev : []
      const idx = arr.indexOf(val)
      next = idx >= 0 ? arr.filter((v) => v !== val) : [...arr, val]
    } else {
      if (prev === val) {
        if (collapsible) next = null
        else return
      } else {
        next = val
      }
    }
    // Controlled: emit only; the parent owns state. Uncontrolled: mutate
    // internal and emit on real change. Mirrors the React/Vue/Solid contract.
    if (isControlled) {
      onValueChange?.(next)
      return
    }
    if (next !== prev) onValueChange?.(next)
    internal = next
  }

  // ── Keyboard navigation (single-sourced in core controller) ──────────
  // Plain non-reactive array: items register/unregister imperatively via
  // context calls from child effects, so `nav.reset()` is invoked directly
  // at the mutation site rather than through a reactive `$effect` (which
  // would create a read/write cycle on the same state between this
  // container and its children).
  interface RegisteredItem {
    value: string
    el: HTMLButtonElement
  }
  const items: RegisteredItem[] = []

  const nav: KeyboardNavController = createKeyboardNav({
    count: items.length,
    loop: true,
    orientation: 'vertical',
  })

  // svelte-ignore state_referenced_locally
  let activeIndex = $state(nav.index)
  $effect(() => {
    const unsub = nav.store.subscribe((next) => {
      activeIndex = next
    })
    return unsub
  })

  function registerItem(value: string, el: HTMLButtonElement): () => void {
    if (!items.find((it) => it.value === value)) {
      items.push({ value, el })
      nav.reset(items.length)
    }
    return () => {
      const idx = items.findIndex((it) => it.value === value)
      if (idx >= 0) {
        items.splice(idx, 1)
        nav.reset(items.length)
      }
    }
  }

  function focusItem(value: string): void {
    const idx = items.findIndex((it) => it.value === value)
    if (idx >= 0) nav.focus(idx)
  }

  function onKeyDown(e: KeyboardEvent): void {
    const action: KeyboardNavAction = nav.handleKeyDown({
      key: e.key,
      preventDefault: () => e.preventDefault(),
    })
    if (action.type === 'focus') {
      items[action.target]?.el.focus()
    }
  }

  setAccordionContext({
    get multiple() {
      return multiple
    },
    get collapsible() {
      return collapsible
    },
    rootId,
    isOpen,
    toggle,
    get activeIndex() {
      return activeIndex
    },
    registerItem,
    focusItem,
  })
</script>

<div
  {...rest}
  data-iris-accordion
  data-iris-accordion-multiple={multiple ? 'true' : undefined}
  onkeydown={onKeyDown}
>
  {@render children?.()}
</div>
