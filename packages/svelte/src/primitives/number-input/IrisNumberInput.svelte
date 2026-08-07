<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  type Size = 'sm' | 'md' | 'lg'

  interface Props {
    value?: number | null
    size?: Size
    min?: number
    max?: number
    step?: number
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    invalid?: boolean
    showControls?: boolean
    id?: string
    ariaDescribedby?: string
    style?: string
    onchange?: (value: number | null) => void
    oninput?: (value: number | null) => void
    onfocus?: (e: FocusEvent) => void
    onblur?: (e: FocusEvent) => void
    [key: string]: unknown
  }

  let {
    value = null,
    size = 'md',
    min = -Infinity,
    max = Infinity,
    step = 1,
    placeholder = '',
    disabled = false,
    readonly = false,
    invalid = false,
    showControls = true,
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
  // svelte-ignore state_referenced_locally
  let rawText = $state<string>(value === null || value === undefined ? '' : String(value))

  const SIZE_MAP: Record<Size, { padding: string; fontSize: string; minHeight: string }> = {
    sm: {
      padding: 'var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px)',
      fontSize: 'var(--iris-font-size-xs, 12px)',
      minHeight: '28px',
    },
    md: {
      padding: 'var(--iris-padding-sm, 6px) var(--iris-padding-md, 12px)',
      fontSize: 'var(--iris-font-size-md, 14px)',
      minHeight: '34px',
    },
    lg: {
      padding: 'var(--iris-space-xs, 8px) var(--iris-padding-md, 12px)',
      fontSize: 'var(--iris-font-size-lg, 16px)',
      minHeight: '40px',
    },
  }

  function decimalsOf(s: number): number {
    if (!Number.isFinite(s)) return 0
    const str = s.toString()
    const dot = str.indexOf('.')
    return dot < 0 ? 0 : str.length - dot - 1
  }

  function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v))
  }

  function roundToStep(v: number, s: number): number {
    const places = decimalsOf(s)
    return Number(v.toFixed(places))
  }

  const wrapperStyle = $derived.by(() => {
    const borderColor = invalid
      ? 'var(--iris-danger)'
      : focused
        ? 'var(--iris-primary)'
        : 'var(--iris-border)'
    const boxShadow = focused
      ? `0 0 0 3px ${invalid ? 'rgba(239, 68, 68, 0.18)' : 'rgba(99, 102, 241, 0.18)'}`
      : 'none'
    const s = SIZE_MAP[size]
    return styleToString({
      display: 'inline-flex',
      'align-items': 'center',
      background: 'var(--iris-background)',
      color: 'var(--iris-foreground)',
      border: `1px solid ${borderColor}`,
      'border-radius': 'var(--iris-radius-md, 6px)',
      opacity: disabled ? '0.6' : '1',
      transition: 'border-color 120ms ease, box-shadow 120ms ease',
      'box-shadow': boxShadow,
      padding: s.padding,
      'min-height': s.minHeight,
      'font-size': s.fontSize,
    })
  })

  const atMin = $derived(value !== null && value !== undefined && value <= min)
  const atMax = $derived(value !== null && value !== undefined && value >= max)

  function setValue(next: number | null) {
    if (next === null) {
      rawText = ''
      onchange?.(null)
      oninput?.(null)
      return
    }
    const clamped = clamp(next, min, max)
    const rounded = roundToStep(clamped, step)
    rawText = String(rounded)
    onchange?.(rounded)
    oninput?.(rounded)
  }

  function increment(factor: 1 | -1) {
    if (disabled || readonly) return
    const base =
      value === null || value === undefined
        ? Number.isFinite(min) && min !== -Infinity
          ? min
          : 0
        : value
    setValue(base + factor * step)
  }

  function handleInput(e: Event) {
    const text = (e.target as HTMLInputElement).value
    rawText = text
    if (text === '' || text === '-') {
      oninput?.(null)
      return
    }
    const parsed = Number(text)
    if (Number.isNaN(parsed)) {
      oninput?.(null)
      return
    }
    oninput?.(parsed)
  }

  function handleBlur(e: FocusEvent) {
    focused = false
    if (value !== null && value !== undefined) {
      const clamped = clamp(value, min, max)
      const rounded = roundToStep(clamped, step)
      rawText = String(rounded)
      if (rounded !== value) onchange?.(rounded)
    }
    onblur?.(e)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      increment(1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      increment(-1)
    }
  }

  const ctrlBtnStyle = styleToString({
    display: 'inline-flex',
    'align-items': 'center',
    'justify-content': 'center',
    width: '22px',
    height: '22px',
    background: 'transparent',
    border: 'none',
    'border-radius': 'var(--iris-radius-sm, 4px)',
    cursor: 'pointer',
    color: 'var(--iris-muted)',
    'line-height': '1',
    'flex-shrink': '0',
  })
</script>

<div
  {...rest}
  data-iris-number-input
  data-iris-number-input-size={size}
  data-state={invalid ? 'invalid' : focused ? 'focused' : 'idle'}
  style={mergeStyle(wrapperStyle, style)}
>
  {#if showControls}
    <button
      type="button"
      data-iris-number-input-dec
      aria-label={t('numberInput.decrement')}
      disabled={disabled || atMin || undefined}
      onclick={() => increment(-1)}
      style="{ctrlBtnStyle}; margin-inline-end: 4px">−</button
    >
  {/if}
  <input
    {id}
    type="text"
    inputmode="decimal"
    role="spinbutton"
    value={rawText}
    {placeholder}
    {disabled}
    readonly={readonly || undefined}
    aria-invalid={invalid ? 'true' : undefined}
    aria-describedby={ariaDescribedby}
    aria-valuenow={value === null || value === undefined ? undefined : value}
    aria-valuemin={Number.isFinite(min) ? min : undefined}
    aria-valuemax={Number.isFinite(max) ? max : undefined}
    oninput={handleInput}
    onfocus={(e) => {
      focused = true
      onfocus?.(e)
    }}
    onblur={handleBlur}
    onkeydown={handleKeyDown}
    style="flex: 1; min-width: 40px; width: 4ch; border: none; outline: none; background: transparent; color: inherit; font-family: inherit; font-size: inherit; padding: 0; text-align: end;"
  />
  {#if showControls}
    <button
      type="button"
      data-iris-number-input-inc
      aria-label={t('numberInput.increment')}
      disabled={disabled || atMax || undefined}
      onclick={() => increment(1)}
      style="{ctrlBtnStyle}; margin-inline-start: 4px">+</button
    >
  {/if}
</div>
