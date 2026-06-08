<script lang="ts">
  import { generateId } from '@iris-ui/core'
  import { setRadioGroupContext, type RadioSize } from './context'

  let {
    value = null,
    name,
    size = 'md',
    disabled = false,
    onchange,
    children,
    ...rest
  }: {
    value?: string | number | boolean | null
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

  function setValue(v: string | number | boolean): void {
    onchange?.(v)
  }

  setRadioGroupContext({
    get name() {
      return groupName
    },
    get value() {
      return value
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
