<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'

  type OtpSize = 'sm' | 'md' | 'lg'
  type OtpType = 'numeric' | 'alphanumeric'

  interface Props {
    value?: string
    length?: number
    type?: OtpType
    mask?: boolean
    size?: OtpSize
    disabled?: boolean
    invalid?: boolean
    autofocus?: boolean
    placeholder?: string
    id?: string
    ariaDescribedby?: string
    style?: string
    onchange?: (value: string) => void
    oncomplete?: (value: string) => void
    [key: string]: unknown
  }

  let {
    value = '',
    length = 6,
    type = 'numeric',
    mask = false,
    size = 'md',
    disabled = false,
    invalid = false,
    autofocus = false,
    placeholder = '',
    id,
    ariaDescribedby,
    style,
    onchange,
    oncomplete,
    ...rest
  }: Props = $props()

  const SIZE_MAP: Record<OtpSize, { box: string; height: string; fontSize: string }> = {
    sm: { box: '32px', height: '36px', fontSize: '14px' },
    md: { box: '38px', height: '44px', fontSize: '18px' },
    lg: { box: '44px', height: '52px', fontSize: '20px' },
  }

  const PATTERNS: Record<OtpType, RegExp> = {
    numeric: /[0-9]/,
    alphanumeric: /[0-9a-zA-Z]/,
  }

  function sanitize(str: string): string {
    const re = PATTERNS[type]
    let out = ''
    for (const ch of str) if (re.test(ch)) out += ch
    return out
  }

  let focusedIndex = $state(-1)
  let cellEls = $state<(HTMLInputElement | null)[]>([])

  const cells = $derived(sanitize(value ?? '').slice(0, length))

  function focusCell(i: number) {
    const idx = Math.max(0, Math.min(length - 1, i))
    const el = cellEls[idx]
    if (el) { el.focus(); el.select() }
  }

  function commit(next: string) {
    const v = sanitize(next).slice(0, length)
    if (v === cells) return
    onchange?.(v)
    if (v.length === length) oncomplete?.(v)
  }

  function writeFrom(startIndex: number, chars: string) {
    const clean = sanitize(chars)
    if (!clean) return
    const start = Math.min(startIndex, cells.length)
    const arr = cells.split('')
    for (let k = 0; k < clean.length && start + k < length; k++)
      arr[start + k] = clean.charAt(k)
    commit(arr.join('').slice(0, length))
    focusCell(start + clean.length)
  }

  function handleInput(i: number, e: Event) {
    const clean = sanitize((e.target as HTMLInputElement).value)
    if (clean) writeFrom(i, clean)
  }

  function handleKeyDown(i: number, e: KeyboardEvent) {
    if (disabled) return
    const key = e.key
    const v = cells
    if (key === 'Backspace') {
      e.preventDefault()
      if (v[i]) {
        commit(v.slice(0, i) + v.slice(i + 1))
        focusCell(i - 1)
      } else if (i > 0) {
        commit(v.slice(0, i - 1) + v.slice(i))
        focusCell(i - 1)
      }
    } else if (key === 'Delete') {
      e.preventDefault()
      if (v[i]) commit(v.slice(0, i) + v.slice(i + 1))
    } else if (key === 'ArrowLeft') {
      e.preventDefault(); focusCell(i - 1)
    } else if (key === 'ArrowRight') {
      e.preventDefault(); focusCell(i + 1)
    } else if (key === 'Home') {
      e.preventDefault(); focusCell(0)
    } else if (key === 'End') {
      e.preventDefault(); focusCell(v.length)
    } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!PATTERNS[type].test(key)) e.preventDefault()
    }
  }

  function handlePaste(i: number, e: ClipboardEvent) {
    e.preventDefault()
    if (disabled) return
    writeFrom(i, e.clipboardData?.getData('text') ?? '')
  }

  $effect(() => {
    if (autofocus) cellEls[0]?.focus()
  })
</script>

<div
  {...rest}
  data-iris-otp-input
  data-iris-otp-input-size={size}
  data-state={invalid ? 'invalid' : 'idle'}
  role="group"
  aria-disabled={disabled ? 'true' : undefined}
  style={mergeStyle(styleToString({ display: 'inline-flex', gap: '8px', direction: 'inherit' }), style)}
>
  {#each Array.from({ length }) as _, i (i)}
    {@const char = cells.charAt(i)}
    {@const isFocused = focusedIndex === i}
    {@const sz = SIZE_MAP[size]}
    {@const borderColor = invalid ? 'var(--iris-danger)' : isFocused ? 'var(--iris-primary)' : 'var(--iris-border)'}
    <input
      bind:this={cellEls[i]}
      id={i === 0 ? id : undefined}
      type={mask ? 'password' : 'text'}
      inputmode={type === 'numeric' ? 'numeric' : 'text'}
      autocomplete={i === 0 ? 'one-time-code' : 'off'}
      maxlength={1}
      value={char}
      placeholder={placeholder || undefined}
      {disabled}
      aria-label={`Digit ${i + 1} of ${length}`}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={ariaDescribedby}
      data-iris-otp-input-cell
      data-filled={char ? 'true' : undefined}
      oninput={(e) => handleInput(i, e)}
      onkeydown={(e) => handleKeyDown(i, e)}
      onpaste={(e) => handlePaste(i, e)}
      onfocus={(e) => { focusedIndex = i; (e.target as HTMLInputElement).select() }}
      onblur={() => { focusedIndex = -1 }}
      style={styleToString({
        width: sz.box,
        height: sz.height,
        'text-align': 'center',
        'font-size': sz.fontSize,
        'font-family': 'inherit',
        'font-variant-numeric': 'tabular-nums',
        color: 'var(--iris-foreground)',
        background: 'var(--iris-background)',
        border: `1px solid ${borderColor}`,
        'border-radius': 'var(--iris-radius-md, 6px)',
        outline: 'none',
        opacity: disabled ? '0.6' : '1',
        'box-shadow': isFocused
          ? `0 0 0 3px ${invalid ? 'rgba(239, 68, 68, 0.18)' : 'rgba(99, 102, 241, 0.18)'}`
          : 'none',
        transition: 'border-color 120ms ease, box-shadow 120ms ease',
      })}
    />
  {/each}
</div>
