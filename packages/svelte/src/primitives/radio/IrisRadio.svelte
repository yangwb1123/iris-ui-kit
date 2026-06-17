<script lang="ts">
  import { getRadioGroupContext, type RadioSize } from './context'

  let {
    value,
    modelValue,
    size: sizeProp,
    disabled: disabledProp = false,
    id,
    onchange,
    children,
    ...rest
  }: {
    value: string | number | boolean
    modelValue?: string | number | boolean | null
    size?: RadioSize
    disabled?: boolean
    id?: string
    onchange?: (value: string | number | boolean) => void
    children?: import('svelte').Snippet
    [key: string]: unknown
  } = $props()

  const group = getRadioGroupContext()

  const size = $derived<RadioSize>(sizeProp ?? group?.size ?? 'md')
  const disabled = $derived(disabledProp || Boolean(group?.disabled))
  const checked = $derived(group ? group.value === value : modelValue === value)

  const DIM: Record<RadioSize, string> = { sm: '14px', md: '18px', lg: '22px' }
  const dim = $derived(DIM[size])

  const boxStyle = $derived(
    `position:relative; display:inline-flex; align-items:center; justify-content:center; width:${dim}; height:${dim}; border-radius:999px; border:1px solid ${checked ? 'var(--iris-primary)' : 'var(--iris-border)'}; background:var(--iris-background); cursor:${disabled ? 'not-allowed' : 'pointer'}; opacity:${disabled ? '0.6' : '1'}; transition:border-color 120ms ease;`,
  )

  const dotStyle = $derived(
    `width:50%; height:50%; border-radius:999px; background:var(--iris-primary); transform:${checked ? 'scale(1)' : 'scale(0)'}; transition:transform 140ms cubic-bezier(0.34,1.56,0.64,1);`,
  )

  function onChange(): void {
    if (disabled) return
    if (group) group.setValue(value)
    else onchange?.(value)
  }
</script>

<label
  {...rest}
  data-iris-radio
  data-iris-radio-size={size}
  data-state={checked ? 'checked' : 'unchecked'}
  style="display:inline-flex; align-items:center; gap:var(--iris-gap-sm); cursor:{disabled
    ? 'not-allowed'
    : 'pointer'}; user-select:none;"
>
  <input
    type="radio"
    {id}
    name={group?.name}
    value={String(value)}
    {checked}
    {disabled}
    onchange={onChange}
    style="position:absolute; opacity:0; width:0; height:0; pointer-events:none;"
  />
  <span aria-hidden="true" style={boxStyle}>
    <span style={dotStyle}></span>
  </span>
  {#if children}
    <span>{@render children()}</span>
  {/if}
</label>
