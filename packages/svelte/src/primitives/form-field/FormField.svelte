<script lang="ts">
  import { generateId } from '@iris-ui/core'
  import { styleToString, mergeStyle } from '../../internal/style'
  import { setFormFieldContext, type FormFieldControl } from './context'
  import type { IrisFormFieldProps } from './types'

  let {
    label,
    hint,
    error,
    required = false,
    labelFor,
    size = 'md',
    style,
    children,
    ...rest
  }: IrisFormFieldProps = $props()

  const generated = generateId()
  const controlId = $derived(labelFor || `${generated}-control`)
  const hintId = `${generated}-hint`
  const errorId = `${generated}-error`
  const describedBy = $derived.by(() => {
    const ids: string[] = []
    if (hint && !error) ids.push(hintId)
    if (error) ids.push(errorId)
    return ids.length ? ids.join(' ') : undefined
  })

  // Publish the wiring so descendant controls self-wire (see context.ts).
  setFormFieldContext({
    get id() {
      return controlId
    },
    get describedBy() {
      return describedBy
    },
    get invalid() {
      return Boolean(error)
    },
  } satisfies FormFieldControl)

  const rootStyle = $derived(
    styleToString({ display: 'flex', 'flex-direction': 'column', gap: '4px' }),
  )
  const labelStyle = $derived(
    styleToString({
      'font-size': size === 'sm' ? '12px' : '14px',
      'font-weight': 500,
      color: error ? 'var(--iris-danger)' : 'var(--iris-foreground)',
      display: 'inline-flex',
      'align-items': 'center',
      gap: '4px',
    }),
  )
</script>

<div
  {...rest}
  data-iris-form-field
  data-iris-form-field-state={error ? 'invalid' : 'valid'}
  style={mergeStyle(rootStyle, style)}
>
  {#if label}
    <label for={controlId} data-iris-form-field-label style={labelStyle}>
      {label}
      {#if required}<span
          aria-hidden="true"
          data-iris-form-field-required
          style="color: var(--iris-danger)">*</span
        >{/if}
    </label>
  {/if}
  {@render children?.()}
  {#if hint && !error}
    <div id={hintId} data-iris-form-field-hint style="font-size: 12px; color: var(--iris-muted)">
      {hint}
    </div>
  {/if}
  {#if error}
    <div
      id={errorId}
      data-iris-form-field-error
      role="alert"
      style="font-size: 12px; color: var(--iris-danger)"
    >
      {error}
    </div>
  {/if}
</div>
