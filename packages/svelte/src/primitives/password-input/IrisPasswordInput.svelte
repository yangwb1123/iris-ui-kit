<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'
  import { useI18n } from '../../i18n'

  const { t } = useI18n()

  type Size = 'sm' | 'md' | 'lg'

  interface Props {
    value?: string
    size?: Size
    placeholder?: string
    disabled?: boolean
    readonly?: boolean
    invalid?: boolean
    showToggle?: boolean
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
    showToggle = true,
    id,
    ariaDescribedby,
    style,
    onchange,
    oninput,
    onfocus,
    onblur,
    ...rest
  }: Props = $props()

  let visible = $state(false)
  let focused = $state(false)

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

  function toggle() {
    if (disabled || readonly) return
    visible = !visible
  }
</script>

<div
  {...rest}
  data-iris-password-input
  data-state={invalid ? 'invalid' : focused ? 'focused' : 'idle'}
  style={mergeStyle(wrapperStyle, style)}
>
  <input
    {id}
    type={visible ? 'text' : 'password'}
    {value}
    {placeholder}
    {disabled}
    readonly={readonly || undefined}
    aria-invalid={invalid ? 'true' : undefined}
    aria-describedby={ariaDescribedby}
    oninput={(e) => {
      const v = (e.target as HTMLInputElement).value
      oninput?.(v)
      onchange?.(v)
    }}
    onfocus={(e) => {
      focused = true
      onfocus?.(e)
    }}
    onblur={(e) => {
      focused = false
      onblur?.(e)
    }}
    style="flex: 1; border: none; outline: none; background: transparent; color: inherit; font-family: inherit; font-size: inherit; padding: 0;"
  />
  {#if showToggle}
    <button
      type="button"
      data-iris-password-input-toggle
      aria-label={visible ? t('passwordInput.hide') : t('passwordInput.show')}
      aria-pressed={visible ? 'true' : 'false'}
      onclick={toggle}
      style="background: transparent; border: none; cursor: {disabled
        ? 'not-allowed'
        : 'pointer'}; color: var(--iris-muted); padding: 0 var(--iris-space-xxs, 4px); font-size: var(--iris-font-size-sm, 13px); line-height: 1;"
      >{visible ? '🙈' : '👁'}</button
    >
  {/if}
</div>
