import { createSignal, For, mergeProps, onMount, splitProps, type JSX } from 'solid-js'
import { useI18n } from '../../i18n'

export type IrisOtpInputSize = 'sm' | 'md' | 'lg'
export type IrisOtpInputType = 'numeric' | 'alphanumeric'

const SIZE_MAP: Record<IrisOtpInputSize, { box: string; height: string; fontSize: string }> = {
  sm: { box: '32px', height: '36px', fontSize: 'var(--iris-font-size-md, 14px)' },
  md: { box: '38px', height: '44px', fontSize: 'var(--iris-font-size-xl, 18px)' },
  lg: { box: '44px', height: '52px', fontSize: 'var(--iris-font-size-2xl, 20px)' },
}

const PATTERNS: Record<IrisOtpInputType, RegExp> = {
  numeric: /[0-9]/,
  alphanumeric: /[0-9a-zA-Z]/,
}

function sanitize(str: string, type: IrisOtpInputType): string {
  const re = PATTERNS[type]
  let out = ''
  for (const ch of str) if (re.test(ch)) out += ch
  return out
}

export interface IrisOtpInputProps {
  value?: string
  defaultValue?: string
  length?: number
  type?: IrisOtpInputType
  mask?: boolean
  size?: IrisOtpInputSize
  disabled?: boolean
  invalid?: boolean
  autofocus?: boolean
  placeholder?: string
  id?: string
  ariaDescribedby?: string
  onChange?: (value: string) => void
  onComplete?: (value: string) => void
  style?: JSX.CSSProperties | string
  class?: string
}

/** Solid port of IrisOtpInput — individual digit boxes with paste and focus. */
export function IrisOtpInput(props: IrisOtpInputProps): JSX.Element {
  const merged = mergeProps(
    { size: 'md' as IrisOtpInputSize, type: 'numeric' as IrisOtpInputType, length: 6 },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'length',
    'type',
    'mask',
    'size',
    'disabled',
    'invalid',
    'autofocus',
    'placeholder',
    'id',
    'ariaDescribedby',
    'onChange',
    'onComplete',
    'style',
  ])

  const { t } = useI18n()

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal(sanitize(local.defaultValue ?? '', local.type))
  const current = (): string =>
    sanitize(isControlled() ? (local.value as string) : internal(), local.type).slice(
      0,
      local.length,
    )

  const [focusedIndex, setFocusedIndex] = createSignal(-1)
  const cellEls: (HTMLInputElement | null)[] = []

  const focusCell = (i: number): void => {
    const idx = Math.max(0, Math.min(local.length - 1, i))
    const el = cellEls[idx]
    if (el) {
      el.focus()
      el.select()
    }
  }

  const commit = (next: string): void => {
    const v = sanitize(next, local.type).slice(0, local.length)
    if (v === current()) return
    if (!isControlled()) setInternal(v)
    local.onChange?.(v)
    if (v.length === local.length) local.onComplete?.(v)
  }

  const writeFrom = (startIndex: number, chars: string): void => {
    const clean = sanitize(chars, local.type)
    if (!clean) return
    const start = Math.min(startIndex, current().length)
    const arr = current().split('')
    for (let k = 0; k < clean.length && start + k < local.length; k++) {
      arr[start + k] = clean.charAt(k)
    }
    commit(arr.join('').slice(0, local.length))
    focusCell(start + clean.length)
  }

  const onInput = (i: number, e: Event): void => {
    const clean = sanitize((e.target as HTMLInputElement).value, local.type)
    if (clean) writeFrom(i, clean)
    // Reset display so controlled value can re-render
    const el = cellEls[i]
    if (el) el.value = current().charAt(i)
  }

  const onKeyDown = (i: number, e: KeyboardEvent): void => {
    if (local.disabled) return
    const key = e.key
    const v = current()
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
      e.preventDefault()
      focusCell(i - 1)
    } else if (key === 'ArrowRight') {
      e.preventDefault()
      focusCell(i + 1)
    } else if (key === 'Home') {
      e.preventDefault()
      focusCell(0)
    } else if (key === 'End') {
      e.preventDefault()
      focusCell(v.length)
    } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!PATTERNS[local.type].test(key)) e.preventDefault()
    }
  }

  const onPaste = (i: number, e: ClipboardEvent): void => {
    e.preventDefault()
    if (local.disabled) return
    writeFrom(i, e.clipboardData?.getData('text') ?? '')
  }

  onMount(() => {
    if (local.autofocus) cellEls[0]?.focus()
  })

  const sz = (): (typeof SIZE_MAP)[IrisOtpInputSize] => SIZE_MAP[local.size]

  return (
    <div
      {...rest}
      data-iris-otp-input=""
      data-iris-otp-input-size={local.size}
      data-state={local.invalid ? 'invalid' : 'idle'}
      role="group"
      aria-disabled={local.disabled ? 'true' : undefined}
      style={{
        display: 'inline-flex',
        gap: '8px',
        ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
      }}
    >
      <For each={Array.from({ length: local.length }, (_, i) => i)}>
        {(i) => {
          const char = (): string => current().charAt(i)
          const isFocused = (): boolean => focusedIndex() === i
          const borderColor = (): string =>
            local.invalid
              ? 'var(--iris-danger)'
              : isFocused()
                ? 'var(--iris-primary)'
                : 'var(--iris-border)'
          return (
            <input
              ref={(el) => {
                cellEls[i] = el
              }}
              id={i === 0 ? local.id : undefined}
              type={local.mask ? 'password' : 'text'}
              inputMode={local.type === 'numeric' ? 'numeric' : 'text'}
              autocomplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={char()}
              placeholder={local.placeholder || undefined}
              disabled={local.disabled}
              aria-label={t('otpInput.cell', { index: i + 1, total: local.length })}
              aria-invalid={local.invalid ? 'true' : undefined}
              aria-describedby={local.ariaDescribedby}
              data-iris-otp-input-cell=""
              data-filled={char() ? 'true' : undefined}
              onInput={(e) => onInput(i, e)}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={(e) => onPaste(i, e)}
              onFocus={(e) => {
                setFocusedIndex(i)
                ;(e.target as HTMLInputElement).select()
              }}
              onBlur={() => setFocusedIndex(-1)}
              style={{
                width: sz().box,
                height: sz().height,
                'text-align': 'center',
                'font-size': sz().fontSize,
                'font-family': 'inherit',
                'font-variant-numeric': 'tabular-nums',
                color: 'var(--iris-foreground)',
                background: 'var(--iris-background)',
                border: `1px solid ${borderColor()}`,
                'border-radius': 'var(--iris-radius-md, 6px)',
                outline: 'none',
                opacity: local.disabled ? 0.6 : 1,
                'box-shadow': isFocused()
                  ? `0 0 0 3px ${local.invalid ? 'color-mix(in srgb, var(--iris-danger) 18%, transparent)' : 'color-mix(in srgb, var(--iris-primary) 18%, transparent)'}`
                  : 'none',
                transition: 'border-color 120ms ease, box-shadow 120ms ease',
              }}
            />
          )
        }}
      </For>
    </div>
  )
}
