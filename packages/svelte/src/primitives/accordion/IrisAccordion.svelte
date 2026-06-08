<script lang="ts">
  import { generateId } from '@iris-ui/core'
  import { setAccordionContext } from './context'

  type AccordionValue = string | string[] | null

  let {
    value: valueProp,
    defaultValue,
    multiple = false,
    collapsible = false,
    children,
    ...rest
  }: {
    value?: AccordionValue
    defaultValue?: AccordionValue
    multiple?: boolean
    collapsible?: boolean
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
    let next: AccordionValue
    if (multiple) {
      const arr = Array.isArray(current) ? current : []
      const idx = arr.indexOf(val)
      next = idx >= 0 ? arr.filter((v) => v !== val) : [...arr, val]
    } else {
      if (current === val) {
        if (collapsible) next = null
        else return
      } else {
        next = val
      }
    }
    if (!isControlled) internal = next
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
