<script lang="ts">
  import { generateId } from '@iris-ui/core'
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
  })
</script>

<div {...rest} data-iris-accordion data-iris-accordion-multiple={multiple ? 'true' : undefined}>
  {@render children?.()}
</div>
