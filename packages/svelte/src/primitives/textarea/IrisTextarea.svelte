<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'

  type Size = 'sm' | 'md' | 'lg'

  interface Props {
    value?: string
    size?: Size
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    invalid?: boolean
    rows?: number
    autosize?: boolean
    maxRows?: number
    maxLength?: number
    id?: string
    ariaDescribedby?: string
    style?: string
    onchange?: (value: string) => void
    oninput?: (value: string) => void
    onfocus?: (e: FocusEvent) => void
    onblur?: (e: FocusEvent) => void
    [key: string]: unknown
  }

  let {
    value = '',
    size = 'md',
    placeholder = '',
    disabled = false,
    readonly = false,
    invalid = false,
    rows = 3,
    autosize = false,
    maxRows = 8,
    maxLength,
    id,
    ariaDescribedby,
    style,
    onchange,
    oninput,
    onfocus,
    onblur,
    ...rest
  }: Props = $props()

  let focused = $state(false)
  let textareaEl = $state<HTMLTextAreaElement | undefined>(undefined)

  const SIZE_MAP: Record<Size, { padding: string; fontSize: string; lineHeight: string }> = {
    sm: {
      padding: 'var(--iris-padding-sm, 6px) var(--iris-space-xs, 8px)',
      fontSize: 'var(--iris-font-size-xs, 12px)',
      lineHeight: '1.5',
    },
    md: {
      padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md, 12px)',
      fontSize: 'var(--iris-font-size-md, 14px)',
      lineHeight: '1.5',
    },
    lg: {
      padding: 'var(--iris-space-sm, 12px) var(--iris-padding-md, 12px)',
      fontSize: 'var(--iris-font-size-lg, 16px)',
      lineHeight: '1.5',
    },
  }

  const wrapperStyle = $derived.by(() => {
    const borderColor = invalid
      ? 'var(--iris-danger)'
      : focused
        ? 'var(--iris-primary)'
        : 'var(--iris-border)'
    const boxShadow = focused
      ? `0 0 0 3px ${invalid ? 'color-mix(in srgb, var(--iris-danger) 18%, transparent)' : 'color-mix(in srgb, var(--iris-primary) 18%, transparent)'}`
      : 'none'
    const s = SIZE_MAP[size]
    return styleToString({
      display: 'flex',
      background: 'var(--iris-background)',
      color: 'var(--iris-foreground)',
      border: `1px solid ${borderColor}`,
      'border-radius': 'var(--iris-radius-md, 6px)',
      opacity: disabled ? '0.6' : '1',
      transition: 'border-color 120ms ease, box-shadow 120ms ease',
      'box-shadow': boxShadow,
      padding: s.padding,
      'font-size': s.fontSize,
      'line-height': s.lineHeight,
    })
  })

  function doResize() {
    const el = textareaEl
    if (!el || !autosize) return
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight || '0') || 20
    el.style.height = 'auto'
    const maxPx = maxRows > 0 ? lineHeight * maxRows : Infinity
    el.style.height = `${Math.min(maxPx, el.scrollHeight)}px`
  }

  $effect(() => {
    // Re-run when value changes and autosize is on
    if (autosize && value !== undefined) {
      // Use microtask so the DOM has updated
      Promise.resolve().then(doResize)
    }
  })

  function handleInput(e: Event) {
    const v = (e.target as HTMLTextAreaElement).value
    oninput?.(v)
    onchange?.(v)
    if (autosize) doResize()
  }

  function handleFocus(e: FocusEvent) {
    focused = true
    onfocus?.(e)
  }

  function handleBlur(e: FocusEvent) {
    focused = false
    onblur?.(e)
  }
</script>

<div
  {...rest}
  data-iris-textarea
  data-iris-textarea-size={size}
  data-state={invalid ? 'invalid' : focused ? 'focused' : 'idle'}
  style={mergeStyle(wrapperStyle, style)}
>
  <textarea
    bind:this={textareaEl}
    {id}
    {rows}
    {placeholder}
    {disabled}
    readonly={readonly || undefined}
    maxlength={maxLength}
    aria-invalid={invalid ? 'true' : undefined}
    aria-describedby={ariaDescribedby}
    oninput={handleInput}
    onfocus={handleFocus}
    onblur={handleBlur}
    style="width: 100%; border: none; outline: none; background: transparent; color: inherit; font-family: inherit; font-size: inherit; line-height: inherit; padding: 0; resize: vertical;"
    >{value}</textarea
  >
  {#if maxLength !== undefined}
    <span
      data-iris-textarea-counter
      style="position: absolute; bottom: 4px; right: 8px; font-size: var(--iris-font-size-xs, 12px); color: var(--iris-muted); pointer-events: none;"
    >
      {(value ?? '').length}/{maxLength}
    </span>
  {/if}
</div>
