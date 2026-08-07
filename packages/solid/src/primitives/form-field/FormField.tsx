import { createUniqueId, mergeProps, Show, splitProps, type JSX } from 'solid-js'
import { FormFieldContext } from './context'

export interface IrisFormFieldProps extends Omit<JSX.HTMLAttributes<HTMLDivElement>, 'children'> {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  /** Override the auto-generated control id. */
  labelFor?: string
  size?: 'sm' | 'md'
  children?: JSX.Element
}

/**
 * Form-field wrapper handling the label / hint / error trio with a11y plumbing.
 * Solid has no `cloneElement`, so instead of injecting props into the child it
 * publishes `{ id, describedBy, invalid }` via context; field controls
 * (`IrisInput`, `IrisSwitch`) self-wire by reading `useFormFieldControl()`.
 * Behaviorally identical to the React/Vue IrisFormField.
 */
export function IrisFormField(props: IrisFormFieldProps): JSX.Element {
  const merged = mergeProps({ required: false, size: 'md' as 'sm' | 'md' }, props)
  const [local, others] = splitProps(merged, [
    'label',
    'hint',
    'error',
    'required',
    'labelFor',
    'size',
    'style',
    'children',
  ])
  const generated = createUniqueId()
  const controlId = (): string => local.labelFor || `${generated}-control`
  const hintId = `${generated}-hint`
  const errorId = `${generated}-error`
  const describedBy = (): string | undefined => {
    const ids: string[] = []
    if (local.hint && !local.error) ids.push(hintId)
    if (local.error) ids.push(errorId)
    return ids.length ? ids.join(' ') : undefined
  }

  return (
    <FormFieldContext.Provider
      value={{ id: controlId, describedBy, invalid: () => Boolean(local.error) }}
    >
      <div
        {...others}
        data-iris-form-field=""
        data-iris-form-field-state={local.error ? 'invalid' : 'valid'}
        style={{
          display: 'flex',
          'flex-direction': 'column',
          gap: '4px',
          ...((local.style as JSX.CSSProperties) ?? {}),
        }}
      >
        <Show when={local.label}>
          <label
            for={controlId()}
            data-iris-form-field-label=""
            style={{
              'font-size':
                local.size === 'sm'
                  ? 'var(--iris-font-size-xs, 12px)'
                  : 'var(--iris-font-size-md, 14px)',
              'font-weight': 500,
              color: local.error ? 'var(--iris-danger)' : 'var(--iris-foreground)',
              display: 'inline-flex',
              'align-items': 'center',
              gap: '4px',
            }}
          >
            {local.label}
            <Show when={local.required}>
              <span
                aria-hidden="true"
                data-iris-form-field-required=""
                style={{ color: 'var(--iris-danger)' }}
              >
                *
              </span>
            </Show>
          </label>
        </Show>
        {local.children}
        <Show when={local.hint && !local.error}>
          <div
            id={hintId}
            data-iris-form-field-hint=""
            style={{ 'font-size': 'var(--iris-font-size-xs, 12px)', color: 'var(--iris-muted)' }}
          >
            {local.hint}
          </div>
        </Show>
        <Show when={local.error}>
          <div
            id={errorId}
            data-iris-form-field-error=""
            role="alert"
            style={{ 'font-size': 'var(--iris-font-size-xs, 12px)', color: 'var(--iris-danger)' }}
          >
            {local.error}
          </div>
        </Show>
      </div>
    </FormFieldContext.Provider>
  )
}
