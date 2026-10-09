import * as React from 'react'
import {
  resolveFormFieldLayout,
  type FormFieldLabelPlacement,
  type LayoutLength,
} from '@iris-ui-kit/core'

export interface IrisFormFieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  /** Override the auto-generated control id. */
  labelFor?: string
  /** Visual size of the label. */
  size?: 'sm' | 'md'
  /** Label above the control (default) or beside it. */
  labelPlacement?: FormFieldLabelPlacement
  /** Width of the label column — a number is read as px. Labels wrap inside it. */
  labelWidth?: LayoutLength
  /** Width of the control area (control + hint/error); a number is read as px. */
  controlWidth?: LayoutLength
  /** Stretch the field (and its control area) to the container width. */
  fullWidth?: boolean
  children?: React.ReactNode
}

type InjectableProps = {
  id?: string
  invalid?: boolean
  ariaDescribedby?: string
}

/**
 * Form-field wrapper that handles the label / hint / error trio with the
 * right a11y plumbing. Non-invasive wrapper around any Iris input primitive
 * (`IrisInput`, `IrisTextarea`, `IrisNumberInput`, `IrisSwitch`, `IrisCheckbox`,
 * `IrisPasswordInput`, …): locates the first valid React element in `children`
 * and clones it with the generated `id`, `aria-describedby`, and `invalid`.
 *
 * ```tsx
 * <IrisFormField label="Email" error={errors.email} hint="We never share it.">
 *   <IrisInput value={email} onChange={setEmail} />
 * </IrisFormField>
 * ```
 *
 * Layout is declarative instead of hand-written CSS — the same four props
 * exist in every adapter and the decisions live in core
 * (`resolveFormFieldLayout`):
 *
 * ```tsx
 * <IrisFormField label="Email" labelPlacement="start" labelWidth={120} fullWidth>
 *   <IrisInput />
 * </IrisFormField>
 * ```
 *
 * Horizontal fields group the control with its hint/error in a
 * `data-iris-form-field-control` wrapper, so help text stays under the control
 * instead of drifting beside the label. That wrapper (and the extra box-model
 * guarantees) is only emitted when a layout prop asks for it — a plain
 * `IrisFormField` renders exactly the DOM it always did.
 */
export const IrisFormField = React.forwardRef<HTMLDivElement, IrisFormFieldProps>(
  function IrisFormField(
    {
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
    },
    ref,
  ) {
    const generated = React.useId()
    const controlId = labelFor || `${generated}-control`
    const hintId = `${generated}-hint`
    const errorId = `${generated}-error`

    const layout = resolveFormFieldLayout({ labelPlacement, labelWidth, controlWidth, fullWidth })

    const describedBy = React.useMemo(() => {
      const ids: string[] = []
      if (hint && !error) ids.push(hintId)
      if (error) ids.push(errorId)
      return ids.length > 0 ? ids.join(' ') : undefined
    }, [hint, error, hintId, errorId])

    let injected = false
    const decorated = React.Children.map(children, (child) => {
      if (!injected && React.isValidElement(child)) {
        injected = true
        const injectedProps: InjectableProps = {
          id: controlId,
          invalid: error ? true : undefined,
          ariaDescribedby: describedBy,
        }
        return React.cloneElement(child, injectedProps as Partial<unknown> as React.Attributes)
      }
      return child
    })

    const labelStyle: React.CSSProperties = {
      fontSize: size === 'sm' ? '12px' : '14px',
      fontWeight: 500,
      color: error ? 'var(--iris-danger)' : 'var(--iris-foreground)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      ...(layout.label as React.CSSProperties),
    }

    const hintNode =
      hint && !error ? (
        <div
          id={hintId}
          data-iris-form-field-hint=""
          style={{ fontSize: 'var(--iris-font-size-xs, 12px)', color: 'var(--iris-muted)' }}
        >
          {hint}
        </div>
      ) : null
    const errorNode = error ? (
      <div
        id={errorId}
        data-iris-form-field-error=""
        role="alert"
        style={{ fontSize: 'var(--iris-font-size-xs, 12px)', color: 'var(--iris-danger)' }}
      >
        {error}
      </div>
    ) : null

    return (
      <div
        {...rest}
        ref={ref}
        data-iris-form-field=""
        data-iris-form-field-state={error ? 'invalid' : 'valid'}
        {...(layout.placement === 'top'
          ? {}
          : { 'data-iris-form-field-placement': layout.placement })}
        style={{
          ...(layout.root as React.CSSProperties),
          ...style,
        }}
      >
        {label ? (
          <label htmlFor={controlId} data-iris-form-field-label="" style={labelStyle}>
            {label}
            {required ? (
              <span
                aria-hidden="true"
                data-iris-form-field-required=""
                style={{ color: 'var(--iris-danger)' }}
              >
                *
              </span>
            ) : null}
          </label>
        ) : null}
        {layout.grouped ? (
          <div data-iris-form-field-control="" style={layout.control as React.CSSProperties}>
            {decorated}
            {hintNode}
            {errorNode}
          </div>
        ) : (
          <>
            {decorated}
            {hintNode}
            {errorNode}
          </>
        )}
      </div>
    )
  },
)
