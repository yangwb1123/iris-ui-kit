<script lang="ts">
  import { generateId } from '@iris-ui/core'
  import { setRadioGroupContext, type RadioSize } from './context'

  let {
    value: valueProp,
    defaultValue = null,
    name,
    size = 'md',
    disabled = false,
    onchange,
    children,
    ...rest
  }: {
    value?: string | number | boolean | null
    defaultValue?: string | number | boolean | null
    name?: string
    size?: RadioSize
    disabled?: boolean
    onchange?: (value: string | number | boolean) => void
    children?: import('svelte').Snippet
    [key: string]: unknown
  } = $props()

  // svelte-ignore state_referenced_locally
  const fallbackName = generateId()
  const groupName = $derived(name ?? fallbackName)
  const isControlled = $derived(valueProp !== undefined)
  // svelte-ignore state_referenced_locally
  let internal = $state(defaultValue)
  const current = $derived(isControlled ? (valueProp ?? null) : internal)

  function setValue(v: string | number | boolean): void {
    if (!isControlled) internal = v
    onchange?.(v)
  }

  setRadioGroupContext({
    get name() {
      return groupName
    },
    get value() {
      return current
    },
    get size() {
      return size
    },
    get disabled() {
      return disabled
    },
    setValue,
  })
</script>

<div
  {...rest}
  role="radiogroup"
  data-iris-radio-group
  style="display:inline-flex; flex-direction:column; gap:var(--iris-gap-sm);"
>
  {@render children?.()}
</div>
