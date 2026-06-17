import { createEffect, createSignal, mergeProps, onMount, splitProps, type JSX } from 'solid-js'
import type { Size } from '@iris-ui/core'

export type IrisTextareaSize = Size

const SIZE_STYLES: Record<IrisTextareaSize, { padding: string; fontSize: string }> = {
  sm: { padding: '6px var(--iris-padding-sm, 8px)', fontSize: '12px' },
  md: { padding: '8px var(--iris-padding-md, 12px)', fontSize: '14px' },
  lg: { padding: '10px var(--iris-padding-md, 12px)', fontSize: '16px' },
}

export interface IrisTextareaProps {
  value?: string
  defaultValue?: string
  size?: IrisTextareaSize
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  invalid?: boolean
  rows?: number
  /** @deprecated Use `autosize` instead. */
  autoResize?: boolean
  /** Automatically grow the textarea height as content grows. */
  autosize?: boolean
  maxRows?: number
  maxLength?: number
  id?: string
  ariaDescribedby?: string
  onChange?: (value: string) => void
  onFocus?: (e: FocusEvent) => void
  onBlur?: (e: FocusEvent) => void
  style?: JSX.CSSProperties | string
  class?: string
}

/** Solid port of IrisTextarea — multi-line input with optional autoResize. */
export function IrisTextarea(props: IrisTextareaProps): JSX.Element {
  const merged = mergeProps(
    { size: 'md' as IrisTextareaSize, rows: 3, maxRows: 8, autoResize: false, autosize: false },
    props,
  )
  const [local, rest] = splitProps(merged, [
    'value',
    'defaultValue',
    'size',
    'placeholder',
    'disabled',
    'readonly',
    'invalid',
    'rows',
    'autoResize',
    'autosize',
    'maxRows',
    'maxLength',
    'id',
    'ariaDescribedby',
    'onChange',
    'onFocus',
    'onBlur',
    'style',
  ])

  const isControlled = (): boolean => local.value !== undefined
  const [internal, setInternal] = createSignal(local.defaultValue ?? '')
  const current = (): string => (isControlled() ? (local.value as string) : internal())

  const [focused, setFocused] = createSignal(false)
  let textareaRef: HTMLTextAreaElement | undefined

  const resize = () => {
    const el = textareaRef
    if (!el || !(local.autoResize || local.autosize)) return
    const lh = parseFloat(getComputedStyle(el).lineHeight || '0') || 20
    el.style.height = 'auto'
    const maxPx = local.maxRows > 0 ? lh * local.maxRows : Infinity
    el.style.height = `${Math.min(maxPx, el.scrollHeight)}px`
  }

  onMount(() => resize())

  createEffect(() => {
    void current()
    resize()
  })

  const borderColor = (): string =>
    local.invalid ? 'var(--iris-danger)' : focused() ? 'var(--iris-primary)' : 'var(--iris-border)'

  const boxShadow = (): string =>
    focused()
      ? `0 0 0 3px ${local.invalid ? 'rgba(239,68,68,0.18)' : 'rgba(99,102,241,0.18)'}`
      : 'none'

  const wrapperStyle = (): JSX.CSSProperties => ({
    display: 'flex',
    background: 'var(--iris-background)',
    color: 'var(--iris-foreground)',
    border: `1px solid ${borderColor()}`,
    'border-radius': 'var(--iris-radius-md, 6px)',
    opacity: local.disabled ? 0.6 : 1,
    transition: 'border-color 120ms ease, box-shadow 120ms ease',
    'box-shadow': boxShadow(),
    padding: SIZE_STYLES[local.size].padding,
    'font-size': SIZE_STYLES[local.size].fontSize,
    'line-height': '1.5',
    ...((typeof local.style === 'object' ? local.style : {}) as JSX.CSSProperties),
  })

  const textareaStyle: JSX.CSSProperties = {
    width: '100%',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    color: 'inherit',
    'font-family': 'inherit',
    'font-size': 'inherit',
    'line-height': 'inherit',
    padding: '0',
    resize: 'vertical',
  }

  const onInput = (e: Event) => {
    const v = (e.target as HTMLTextAreaElement).value
    if (!isControlled()) setInternal(v)
    local.onChange?.(v)
  }

  const onFocus = (e: FocusEvent) => {
    setFocused(true)
    local.onFocus?.(e)
  }

  const onBlur = (e: FocusEvent) => {
    setFocused(false)
    local.onBlur?.(e)
  }

  return (
    <div
      {...rest}
      data-iris-textarea=""
      data-iris-textarea-size={local.size}
      data-state={local.invalid ? 'invalid' : focused() ? 'focused' : 'idle'}
      style={wrapperStyle()}
    >
      <textarea
        ref={textareaRef}
        id={local.id}
        rows={local.rows}
        value={current()}
        placeholder={local.placeholder}
        disabled={local.disabled}
        readonly={local.readonly}
        maxLength={local.maxLength}
        aria-invalid={local.invalid ? 'true' : undefined}
        aria-describedby={local.ariaDescribedby}
        style={textareaStyle}
        onInput={onInput}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </div>
  )
}
