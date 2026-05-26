import * as React from 'react'

export interface IrisFormFieldProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  /** Override the auto-generated control id. */
  labelFor?: string
  /** Visual size of the label. */
  size?: 'sm' | 'md'
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
 */
export const IrisFormField = React.forwardRef<HTMLDivElement, IrisFormFieldProps>(
  function IrisFormField(
    { label, hint, error, required = false, labelFor, size = 'md', style, children, ...rest },
    ref,
  ) {
    const generated = React.useId()
    const controlId = labelFor || `${generated}-control`
    const hintId = `${generated}-hint`
    const errorId = `${generated}-error`

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
    }

    return (
      <div
        {...rest}
        ref={ref}
        data-iris-form-field=""
        data-iris-form-field-state={error ? 'invalid' : 'valid'}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
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
        {decorated}
        {hint && !error ? (
          <div
            id={hintId}
            data-iris-form-field-hint=""
            style={{ fontSize: 12, color: 'var(--iris-muted)' }}
          >
            {hint}
          </div>
        ) : null}
        {error ? (
          <div
            id={errorId}
            data-iris-form-field-error=""
            role="alert"
            style={{ fontSize: 12, color: 'var(--iris-danger)' }}
          >
            {error}
          </div>
        ) : null}
      </div>
    )
  },
)
