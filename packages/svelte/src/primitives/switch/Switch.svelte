<script lang="ts">
  import { useFormFieldControl } from '../form-field/context'
  import { styleToString, mergeStyle } from '../../internal/style'
  import type { IrisSwitchProps, IrisSwitchSize } from './types'

  const DIM_MAP: Record<IrisSwitchSize, { width: string; height: string; thumb: string }> = {
    sm: { width: '28px', height: '16px', thumb: '12px' },
    md: { width: '36px', height: '20px', thumb: '16px' },
    lg: { width: '44px', height: '24px', thumb: '20px' },
  }

  let {
    checked,
    defaultChecked,
    onChange,
    size = 'md',
    disabled = false,
    invalid = false,
    ariaDescribedby,
    style,
    id,
    ...rest
  }: IrisSwitchProps = $props()

  const field = useFormFieldControl()
  // svelte-ignore state_referenced_locally — uncontrolled seed; controlled reads use the prop.
  let internal = $state(Boolean(defaultChecked))
  const isControlled = $derived(checked !== undefined)
  const value = $derived(isControlled ? Boolean(checked) : internal)

  function handleChange(e: Event & { currentTarget: EventTarget & HTMLInputElement }) {
    if (disabled) return
    const next = e.currentTarget.checked
    if (!isControlled) internal = next
    onChange?.(next, e)
  }

  const isInvalid = $derived(invalid || (field?.invalid ?? false))
  const describedBy = $derived(ariaDescribedby ?? field?.describedBy)
  const controlId = $derived(id ?? field?.id)
  const dim = $derived(DIM_MAP[size])
  const thumbOffset = $derived(value ? `calc(${dim.width} - ${dim.thumb} - 2px)` : '2px')

  const rootStyle = $derived(
    styleToString({
      display: 'inline-flex',
      'align-items': 'center',
      gap: '8px',
      cursor: disabled ? 'not-allowed' : 'pointer',
      'user-select': 'none',
    }),
  )
  const trackStyle = $derived(
    styleToString({
      position: 'relative',
      display: 'inline-block',
      width: dim.width,
      height: dim.height,
      background: value ? 'var(--iris-primary)' : 'var(--iris-border)',
      'border-radius': '999px',
      transition: 'background-color 120ms ease',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      'vertical-align': 'middle',
    }),
  )
  const thumbStyle = $derived(
    styleToString({
      position: 'absolute',
      top: '50%',
      transform: 'translateY(-50%)',
      left: thumbOffset,
      width: dim.thumb,
      height: dim.thumb,
      background: 'var(--iris-background)',
      'border-radius': '999px',
      transition: 'left 140ms ease',
      'box-shadow': '0 1px 3px rgba(0, 0, 0, 0.18)',
    }),
  )
</script>

<label
  data-iris-switch
  data-iris-switch-size={size}
  data-state={value ? 'checked' : 'unchecked'}
  style={mergeStyle(rootStyle, style)}
>
  <input
    {...rest}
    id={controlId}
    type="checkbox"
    role="switch"
    checked={value}
    {disabled}
    aria-checked={value ? 'true' : 'false'}
    aria-describedby={describedBy}
    aria-invalid={isInvalid ? 'true' : undefined}
    onchange={handleChange}
    style="position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none"
  />
  <span aria-hidden="true" style={trackStyle}>
    <span style={thumbStyle}></span>
  </span>
</label>
