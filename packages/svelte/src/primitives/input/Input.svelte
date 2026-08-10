<script lang="ts">
  import { useFormFieldControl } from '../form-field/context'
  import { styleToString, mergeStyle } from '../../internal/style'
  import type { IrisInputProps, IrisInputSize } from './types'

  const SIZE_MAP: Record<IrisInputSize, { padding: string; fontSize: string; minHeight: string }> =
    {
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

  let {
    size = 'md',
    type = 'text',
    invalid = false,
    ariaDescribedby,
    prefix,
    suffix,
    style,
    id,
    onfocus,
    onblur,
    ...rest
  }: IrisInputProps = $props()

  const field = useFormFieldControl()
  let focused = $state(false)

  const isInvalid = $derived(invalid || (field?.invalid ?? false))
  const describedBy = $derived(ariaDescribedby ?? field?.describedBy)
  const controlId = $derived(id ?? field?.id)
  const sizeStyle = $derived(SIZE_MAP[size])
  const borderColor = $derived(
    isInvalid ? 'var(--iris-danger)' : focused ? 'var(--iris-primary)' : 'var(--iris-border)',
  )

  const wrapperStyle = $derived(
    styleToString({
      display: 'inline-flex',
      'align-items': 'center',
      gap: 'var(--iris-space-xs, 8px)',
      background: 'var(--iris-background)',
      color: 'var(--iris-foreground)',
      border: `1px solid ${borderColor}`,
      'border-radius': 'var(--iris-radius-md, 6px)',
      cursor: rest.disabled ? 'not-allowed' : 'text',
      opacity: rest.disabled ? 0.6 : 1,
      transition: 'border-color 120ms ease, box-shadow 120ms ease',
      'box-shadow': focused
        ? `0 0 0 3px ${isInvalid ? 'color-mix(in srgb, var(--iris-danger) 18%, transparent)' : 'color-mix(in srgb, var(--iris-primary) 18%, transparent)'}`
        : 'none',
      padding: sizeStyle.padding,
      'min-height': sizeStyle.minHeight,
      'font-size': sizeStyle.fontSize,
    }),
  )

  function handleFocus(e: FocusEvent & { currentTarget: EventTarget & HTMLInputElement }) {
    focused = true
    onfocus?.(e)
  }
  function handleBlur(e: FocusEvent & { currentTarget: EventTarget & HTMLInputElement }) {
    focused = false
    onblur?.(e)
  }
</script>

<label
  data-iris-input
  data-iris-input-size={size}
  data-state={isInvalid ? 'invalid' : focused ? 'focused' : 'idle'}
  style={mergeStyle(wrapperStyle, style)}
>
  {#if prefix}
    <span
      data-iris-input-prefix
      style="display: inline-flex; align-items: center; color: var(--iris-muted)"
      >{@render prefix()}</span
    >
  {/if}
  <input
    {...rest}
    id={controlId}
    {type}
    aria-invalid={isInvalid ? 'true' : undefined}
    aria-describedby={describedBy}
    style="flex: 1; min-width: 0; border: none; outline: none; background: transparent; color: inherit; font-family: inherit; font-size: inherit; padding: 0"
    onfocus={handleFocus}
    onblur={handleBlur}
  />
  {#if suffix}
    <span
      data-iris-input-suffix
      style="display: inline-flex; align-items: center; color: var(--iris-muted)"
      >{@render suffix()}</span
    >
  {/if}
</label>
