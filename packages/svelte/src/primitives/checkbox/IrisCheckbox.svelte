<script lang="ts">
  type CheckboxValue = boolean | 'indeterminate'
  type CheckboxSize = 'sm' | 'md' | 'lg'

  let {
    value: valueProp = false,
    size = 'md',
    disabled = false,
    id,
    name,
    checkboxValue,
    ariaDescribedby,
    ariaLabel,
    invalid = false,
    onchange,
    children,
    ...rest
  }: {
    value?: CheckboxValue
    size?: CheckboxSize
    disabled?: boolean
    id?: string
    name?: string
    checkboxValue?: string | number
    ariaDescribedby?: string
    ariaLabel?: string
    invalid?: boolean
    onchange?: (value: boolean) => void
    children?: import('svelte').Snippet
    [key: string]: unknown
  } = $props()

  const checkState = $derived<'checked' | 'unchecked' | 'indeterminate'>(
    valueProp === 'indeterminate' ? 'indeterminate' : valueProp ? 'checked' : 'unchecked',
  )

  const DIM: Record<CheckboxSize, string> = { sm: '14px', md: '18px', lg: '22px' }
  const dim = $derived(DIM[size])

  const boxStyle = $derived(
    `display:inline-flex; align-items:center; justify-content:center; width:${dim}; height:${dim}; border-radius:var(--iris-radius-sm); border:1px solid ${checkState === 'unchecked' ? 'var(--iris-border)' : 'var(--iris-primary)'}; background:${checkState === 'unchecked' ? 'var(--iris-background)' : 'var(--iris-primary)'}; color:var(--iris-primary-foreground); cursor:${disabled ? 'not-allowed' : 'pointer'}; opacity:${disabled ? '0.6' : '1'}; transition:background-color 120ms ease,border-color 120ms ease; vertical-align:middle;`,
  )

  function onChange(event: Event): void {
    const next = (event.target as HTMLInputElement).checked
    onchange?.(next)
  }

  let inputEl: HTMLInputElement | undefined = $state(undefined)
  $effect(() => {
    if (inputEl) {
      inputEl.indeterminate = valueProp === 'indeterminate'
    }
  })
</script>

<label
  {...rest}
  data-iris-checkbox
  data-iris-checkbox-size={size}
  data-state={checkState}
  style="display:inline-flex; align-items:center; gap:var(--iris-gap-sm); cursor:{disabled ? 'not-allowed' : 'pointer'}; user-select:none;"
>
  <input
    bind:this={inputEl}
    type="checkbox"
    {id}
    {name}
    value={checkboxValue}
    checked={valueProp === true}
    {disabled}
    aria-checked={checkState === 'indeterminate' ? 'mixed' : checkState === 'checked' ? 'true' : 'false'}
    aria-describedby={ariaDescribedby}
    aria-label={ariaLabel}
    aria-invalid={invalid ? 'true' : undefined}
    onchange={onChange}
    style="position:absolute; opacity:0; width:0; height:0; pointer-events:none;"
  />
  <span aria-hidden="true" style={boxStyle}>
    {#if checkState === 'indeterminate'}
      <span style="width:60%; height:2px; background:currentColor; border-radius:1px;"></span>
    {:else if checkState === 'checked'}
      <svg aria-hidden="true" viewBox="0 0 16 16" width="80%" height="80%" fill="none">
        <path
          d="M3 8.5 L6.5 12 L13 4.5"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    {/if}
  </span>
  {#if children}
    <span>{@render children()}</span>
  {/if}
</label>
