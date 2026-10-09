<script lang="ts">
  import { hyphenateLayoutStyle, resolveFormFieldLayout } from '@iris-ui-kit/core'
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
    labelPlacement,
    labelWidth,
    controlWidth,
    fullWidth,
    style,
    children,
    ...rest
  }: IrisFormFieldProps = $props()

  const generated = $props.id()
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

  // Layout is decided in core so react/vue/solid lay out identically.
  const layout = $derived(
    resolveFormFieldLayout({
      labelPlacement,
      labelWidth,
      controlWidth,
      fullWidth,
    }),
  )

  const rootStyle = $derived(styleToString(hyphenateLayoutStyle(layout.root)))
  const labelStyle = $derived(
    styleToString({
      'font-size':
        size === 'sm' ? 'var(--iris-font-size-xs, 12px)' : 'var(--iris-font-size-md, 14px)',
      'font-weight': 500,
      color: error ? 'var(--iris-danger)' : 'var(--iris-foreground)',
      display: 'inline-flex',
      'align-items': 'center',
      gap: '4px',
      ...hyphenateLayoutStyle(layout.label),
    }),
  )
  const controlStyle = $derived(styleToString(hyphenateLayoutStyle(layout.control)))
</script>

<div
  {...rest}
  data-iris-form-field
  data-iris-form-field-state={error ? 'invalid' : 'valid'}
  data-iris-form-field-placement={layout.placement === 'top' ? undefined : layout.placement}
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
  <!-- The control area is grouped under its own wrapper when a layout prop asks
       for one (horizontal fields keep help/error under the control). -->
  {#if layout.grouped}
    <div data-iris-form-field-control style={controlStyle}>
      {@render children?.()}
      {#if hint && !error}
        <div
          id={hintId}
          data-iris-form-field-hint
          style="font-size: var(--iris-font-size-xs, 12px); color: var(--iris-muted)"
        >
          {hint}
        </div>
      {/if}
      {#if error}
        <div
          id={errorId}
          data-iris-form-field-error
          role="alert"
          style="font-size: var(--iris-font-size-xs, 12px); color: var(--iris-danger)"
        >
          {error}
        </div>
      {/if}
    </div>
  {:else}
    {@render children?.()}
    {#if hint && !error}
      <div
        id={hintId}
        data-iris-form-field-hint
        style="font-size: var(--iris-font-size-xs, 12px); color: var(--iris-muted)"
      >
        {hint}
      </div>
    {/if}
    {#if error}
      <div
        id={errorId}
        data-iris-form-field-error
        role="alert"
        style="font-size: var(--iris-font-size-xs, 12px); color: var(--iris-danger)"
      >
        {error}
      </div>
    {/if}
  {/if}
</div>
